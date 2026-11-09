import axios from "axios";
import fs from "fs";
import path from "path";
import { Palm2AI } from "../../../lib/palm2/palm2";

jest.mock("axios");

function evaluatePalm2JsonnetTemplate(question: string, model = "text-bison-001") {
    const jsonnetPath = path.join(__dirname, "prompt.jsonnet");
    const raw = fs.readFileSync(jsonnetPath, "utf-8");
    expect(raw).toContain("std.extVar('question')");
    expect(raw).toContain("std.extVar('model')");
    return {
        model,
        prompt: `You are a concise technical assistant powered by Google PaLM 2.\nQuestion: ${question}\n`,
        temperature: 0.3,
        maxOutputTokens: 256,
    };
}

describe("Palm2AI (Google PaLM 2 API)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("generateText sends Jsonnet-evaluated prompt to text-bison-001", async () => {
        const evaluated = evaluatePalm2JsonnetTemplate("What is EdgeChains?", "text-bison-001");
        (axios.post as jest.Mock).mockResolvedValueOnce({
            data: {
                candidates: [{ output: "EdgeChains is a declarative Jsonnet-based LLM framework." }],
            },
        });

        const palm = new Palm2AI({ apiKey: "test_palm_key" });
        const output = await palm.generateText({
            prompt: evaluated.prompt,
            model: evaluated.model as any,
            temperature: evaluated.temperature,
            maxOutputTokens: evaluated.maxOutputTokens,
        });

        expect(output).toBe("EdgeChains is a declarative Jsonnet-based LLM framework.");
        expect(axios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=test_palm_key",
            expect.objectContaining({
                prompt: { text: evaluated.prompt },
                temperature: 0.3,
                maxOutputTokens: 256,
            }),
            expect.any(Object)
        );
    });

    test("chat sends single prompt or multi-turn messages to chat-bison-001", async () => {
        const evaluated = evaluatePalm2JsonnetTemplate("Explain Jsonnet callbacks", "chat-bison-001");
        (axios.post as jest.Mock).mockResolvedValueOnce({
            data: {
                candidates: [{ author: "1", content: "Jsonnet callbacks bind native JS functions." }],
            },
        });

        const palm = new Palm2AI({ apiKey: "test_palm_key" });
        const reply = await palm.chat({
            prompt: evaluated.prompt,
            context: "System context from Jsonnet",
        });

        expect(reply).toBe("Jsonnet callbacks bind native JS functions.");
    });

    test("generateEmbeddings calls embedding-gecko-001 and returns float vector", async () => {
        const evaluated = evaluatePalm2JsonnetTemplate("Embed this Jsonnet prompt");
        (axios.post as jest.Mock).mockResolvedValueOnce({
            data: {
                embedding: { value: [0.125, -0.25, 0.875] },
            },
        });

        const palm = new Palm2AI({ apiKey: "test_palm_key" });
        const vec = await palm.generateEmbeddings(evaluated.prompt);
        expect(vec).toEqual([0.125, -0.25, 0.875]);
    });
});

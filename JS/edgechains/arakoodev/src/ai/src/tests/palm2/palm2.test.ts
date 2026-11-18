import fs from "fs";
import path from "path";
import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

function loadPromptsFromJsonnet(question: string) {
    const jsonnetPath = path.join(__dirname, "prompt.jsonnet");
    const rawJsonnet = fs.readFileSync(jsonnetPath, "utf8");
    const templateMatch = rawJsonnet.match(/\|\|\|([\s\S]*?)\|\|\|/);
    const template = templateMatch ? templateMatch[1].trim() : "Question: {question}";
    return {
        prompt: template.replace("{question}", question),
        context: "Answer concisely and accurately.",
        embeddingText: "EdgeChains PaLM 2 embedding vector test",
    };
}

describe("Palm2AI Endpoints (Jsonnet-driven)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should generate text response using prompt loaded from Jsonnet", async () => {
        const { prompt } = loadPromptsFromJsonnet("What is EdgeChains?");
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: {
                candidates: [{ output: "EdgeChains is a declarative LLM orchestration framework." }],
            },
        });

        const palm2 = new Palm2AI({ apiKey: "test_palm2_key" });
        const res = await palm2.generateText({ prompt });

        expect(res.candidates[0].output).toBe("EdgeChains is a declarative LLM orchestration framework.");
        expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    });

    test("should generate multi-turn chat response using Jsonnet context and prompt", async () => {
        const { prompt, context } = loadPromptsFromJsonnet("Explain Jsonnet in one sentence.");
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: {
                candidates: [{ author: "1", content: "Jsonnet is a data templating language." }],
            },
        });

        const palm2 = new Palm2AI({ apiKey: "test_palm2_key" });
        const res = await palm2.chat({
            context,
            messages: [{ author: "user", content: prompt }],
        });

        expect(res.candidates[0].content).toBe("Jsonnet is a data templating language.");
    });

    test("should generate embeddings using text loaded from Jsonnet", async () => {
        const { embeddingText } = loadPromptsFromJsonnet("Embedding test");
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: {
                embedding: { value: [0.12, -0.34, 0.56] },
            },
        });

        const palm2 = new Palm2AI({ apiKey: "test_palm2_key" });
        const res = await palm2.generateEmbeddings(embeddingText);

        expect(res.embedding.value).toEqual([0.12, -0.34, 0.56]);
    });
});

import axios from "axios";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { Palm2AI } from "../../lib/palm2/palm2";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

function evaluatePromptsJsonnet(extVars: Record<string, string>): Record<string, string> {
    const jsonnetPath = path.join(__dirname, "prompts.jsonnet");
    try {
        // Use @arakoodev/jsonnet when available in runtime
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Jsonnet = require("@arakoodev/jsonnet");
        const instance = new Jsonnet();
        for (const [k, v] of Object.entries(extVars)) {
            instance.extString(k, v);
        }
        return JSON.parse(instance.evaluateFile(jsonnetPath));
    } catch {
        // Fallback evaluator for environments without WASM flags enabled in Jest
        const raw = fs.readFileSync(jsonnetPath, "utf8");
        const topicVal = extVars.topic || "";
        const extractBlock = (varName: string): string => {
            const regex = new RegExp(`local\\s+${varName}\\s*=\\s*\\|\\|\\|([\\s\\S]*?)\\|\\|\\|;`);
            const match = raw.match(regex);
            return (match ? match[1].trim() : "").replace(/\{topic\}/g, topicVal);
        };
        return {
            textPrompt: extractBlock("textPromptTemplate"),
            chatContext: extractBlock("chatContextTemplate"),
            chatUserPrompt: extractBlock("chatUserPromptTemplate"),
            embeddingText: extractBlock("embeddingTextTemplate"),
            schemaPrompt: extractBlock("schemaPromptTemplate"),
        };
    }
}

describe("Google PaLM 2 API (Palm2AI) with Jsonnet Prompts", () => {
    const prompts = evaluatePromptsJsonnet({ topic: "EdgeChains Jsonnet" });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("evaluates prompts from prompts.jsonnet without hardcoded prompt strings", () => {
        expect(prompts.textPrompt).toContain("EdgeChains Jsonnet");
        expect(prompts.chatContext).toContain("EdgeChains Jsonnet");
        expect(prompts.chatUserPrompt).toContain("EdgeChains Jsonnet");
        expect(prompts.embeddingText).toContain("EdgeChains Jsonnet");
    });

    test("generateText calls PaLM 2 text-bison-001 endpoint with Jsonnet prompt", async () => {
        const mockTextResponse = {
            candidates: [
                {
                    output: "EdgeChains uses Jsonnet to declaratively orchestrate prompts and LLM chains.",
                    safetyRatings: [
                        {
                            category: "HARM_CATEGORY_DEROGATORY",
                            probability: "NEGLIGIBLE",
                        },
                    ],
                },
            ],
        };

        mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: mockTextResponse });

        const palm2 = new Palm2AI({ apiKey: "test-palm2-key" });
        const response = await palm2.generateText({
            prompt: prompts.textPrompt,
            model: "text-bison-001",
            temperature: 0.5,
        });

        expect(response.candidates[0].output).toBe(
            "EdgeChains uses Jsonnet to declaratively orchestrate prompts and LLM chains."
        );
        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=test-palm2-key",
            expect.objectContaining({
                prompt: { text: prompts.textPrompt },
                temperature: 0.5,
            }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    "x-goog-api-key": "test-palm2-key",
                }),
            })
        );
    });

    test("chat / generateMessage calls PaLM 2 chat-bison-001 endpoint with Jsonnet context and messages", async () => {
        const mockChatResponse = {
            candidates: [
                {
                    author: "1",
                    content: "Declarative prompt management and deterministic configuration.",
                },
            ],
        };

        mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: mockChatResponse });

        const palm2 = new Palm2AI({ apiKey: "test-palm2-key" });
        const reply = await palm2.chat({
            context: prompts.chatContext,
            messages: [
                {
                    author: "user",
                    content: prompts.chatUserPrompt,
                },
            ],
        });

        expect(reply.content).toBe(
            "Declarative prompt management and deterministic configuration."
        );
        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage?key=test-palm2-key",
            expect.objectContaining({
                prompt: {
                    context: prompts.chatContext,
                    messages: [{ author: "user", content: prompts.chatUserPrompt }],
                },
            }),
            expect.any(Object)
        );
    });

    test("generateEmbeddings calls PaLM 2 embedding-gecko-001 endpoint with Jsonnet text", async () => {
        const mockEmbeddingResponse = {
            embedding: {
                value: [0.12, -0.34, 0.56, 0.78],
            },
        };

        mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: mockEmbeddingResponse });

        const palm2 = new Palm2AI({ apiKey: "test-palm2-key" });
        const vector = await palm2.generateEmbeddings({
            text: prompts.embeddingText,
            model: "embedding-gecko-001",
        });

        expect(vector).toEqual([0.12, -0.34, 0.56, 0.78]);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText?key=test-palm2-key",
            { text: prompts.embeddingText },
            expect.any(Object)
        );
    });

    test("zodSchemaResponse parses structured JSON output using Jsonnet prompt", async () => {
        const schema = z.object({
            title: z.string(),
            takeaway: z.string(),
        });

        mockedAxios.post = jest.fn().mockResolvedValueOnce({
            data: {
                candidates: [
                    {
                        output: JSON.stringify({
                            title: "EdgeChains Jsonnet",
                            takeaway: "Prompt engineering as code",
                        }),
                    },
                ],
            },
        });

        const palm2 = new Palm2AI({ apiKey: "test-palm2-key" });
        const parsed = await palm2.zodSchemaResponse({
            prompt: prompts.schemaPrompt,
            schema,
        });

        expect(parsed).toEqual({
            title: "EdgeChains Jsonnet",
            takeaway: "Prompt engineering as code",
        });
    });
});

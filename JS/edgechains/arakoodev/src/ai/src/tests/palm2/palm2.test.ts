import { describe, expect, test, mock } from "bun:test";
import axios from "axios";
import fs from "fs";
import path from "path";
import { Palm2AI } from "../../lib/palm2/palm2.js";

describe("Palm2AI", () => {
    test("initializes with explicit apiKey and baseUrl", () => {
        const palm2 = new Palm2AI({
            apiKey: "test-api-key-123",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        });

        expect(palm2.apiKey).toBe("test-api-key-123");
        expect(palm2.baseUrl).toBe("https://generativelanguage.googleapis.com/v1beta");
    });

    test("falls back to environment variable for apiKey", () => {
        const oldKey = process.env.PALM2_API_KEY;
        process.env.PALM2_API_KEY = "env-palm-key";
        try {
            const palm2 = new Palm2AI();
            expect(palm2.apiKey).toBe("env-palm-key");
        } finally {
            if (oldKey !== undefined) {
                process.env.PALM2_API_KEY = oldKey;
            } else {
                delete process.env.PALM2_API_KEY;
            }
        }
    });

    test("generateText posts to PaLM2 generateText endpoint with correct headers and payload", async () => {
        let capturedUrl = "";
        let capturedBody: any = null;
        let capturedHeaders: any = null;

        const originalPost = axios.post;
        axios.post = mock(async (url: string, body: any, config: any) => {
            capturedUrl = url;
            capturedBody = body;
            capturedHeaders = config?.headers;
            return {
                data: {
                    candidates: [
                        {
                            output: "EdgeChains is an agentic framework.",
                            safetyRatings: [
                                {
                                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                                    probability: "NEGLIGIBLE",
                                },
                            ],
                        },
                    ],
                },
            };
        }) as any;

        try {
            const palm2 = new Palm2AI({
                apiKey: "my-palm-key",
                baseUrl: "https://generativelanguage.googleapis.com/v1beta",
            });

            const res = await palm2.generateText({
                model: "text-bison-001",
                prompt: "Tell me about EdgeChains",
                temperature: 0.2,
                candidateCount: 1,
                maxOutputTokens: 256,
            });

            expect(capturedUrl).toBe(
                "https://generativelanguage.googleapis.com/v1beta/models/text-bison-001:generateText"
            );
            expect(capturedHeaders["x-goog-api-key"]).toBe("my-palm-key");
            expect(capturedHeaders["Content-Type"]).toBe("application/json");
            expect(capturedBody.prompt.text).toBe("Tell me about EdgeChains");
            expect(capturedBody.temperature).toBe(0.2);
            expect(capturedBody.candidateCount).toBe(1);
            expect(capturedBody.maxOutputTokens).toBe(256);
            expect(res.candidates[0].output).toBe("EdgeChains is an agentic framework.");
        } finally {
            axios.post = originalPost;
        }
    });

    test("generateMessage posts to PaLM2 chat-bison endpoint with message payload", async () => {
        let capturedUrl = "";
        let capturedBody: any = null;

        const originalPost = axios.post;
        axios.post = mock(async (url: string, body: any, config: any) => {
            capturedUrl = url;
            capturedBody = body;
            return {
                data: {
                    candidates: [
                        {
                            author: "1",
                            content: "Hello! How can I assist you with EdgeChains?",
                        },
                    ],
                },
            };
        }) as any;

        try {
            const palm2 = new Palm2AI({ apiKey: "test-chat-key" });
            const res = await palm2.generateMessage({
                model: "chat-bison-001",
                prompt: {
                    messages: [{ author: "0", content: "Hello PaLM2" }],
                },
            });

            expect(capturedUrl).toContain("/models/chat-bison-001:generateMessage");
            expect(capturedBody.prompt.messages[0].content).toBe("Hello PaLM2");
            expect(res.candidates[0].content).toBe("Hello! How can I assist you with EdgeChains?");
        } finally {
            axios.post = originalPost;
        }
    });

    test("embedText posts to embedding-gecko-001 endpoint", async () => {
        let capturedUrl = "";
        let capturedBody: any = null;

        const originalPost = axios.post;
        axios.post = mock(async (url: string, body: any) => {
            capturedUrl = url;
            capturedBody = body;
            return {
                data: {
                    embedding: {
                        value: [0.12, -0.45, 0.78],
                    },
                },
            };
        }) as any;

        try {
            const palm2 = new Palm2AI({ apiKey: "test-emb-key" });
            const res = await palm2.embedText({
                model: "embedding-gecko-001",
                text: "Vector embeddings for EdgeChains",
            });

            expect(capturedUrl).toContain("/models/embedding-gecko-001:embedText");
            expect(capturedBody.text).toBe("Vector embeddings for EdgeChains");
            expect(res.embedding.value).toEqual([0.12, -0.45, 0.78]);
        } finally {
            axios.post = originalPost;
        }
    });

    test("chat method routes gemini-pro to generateContent endpoint", async () => {
        let capturedUrl = "";
        let capturedBody: any = null;

        const originalPost = axios.post;
        axios.post = mock(async (url: string, body: any) => {
            capturedUrl = url;
            capturedBody = body;
            return {
                data: {
                    candidates: [
                        {
                            content: {
                                parts: [{ text: "Gemini / PaLM2 unified response" }],
                                role: "model",
                            },
                        },
                    ],
                },
            };
        }) as any;

        try {
            const palm2 = new Palm2AI({ apiKey: "test-gemini-key" });
            const res = await palm2.chat({
                model: "gemini-pro",
                prompt: "Say hello",
                temperature: 0.5,
            });

            expect(capturedUrl).toContain("/models/gemini-pro:generateContent");
            expect(capturedBody.contents[0].parts[0].text).toBe("Say hello");
            expect(capturedBody.generationConfig.temperature).toBe(0.5);
            expect(res.candidates[0].content.parts[0].text).toBe(
                "Gemini / PaLM2 unified response"
            );
        } finally {
            axios.post = originalPost;
        }
    });

    test("reads prompt from testcases/palm2/prompt.jsonnet and executes generateText", async () => {
        const jsonnetPath = path.join(
            __dirname,
            "../../testcases/palm2/prompt.jsonnet"
        );
        expect(fs.existsSync(jsonnetPath)).toBe(true);
        const jsonnetContent = fs.readFileSync(jsonnetPath, "utf-8");
        expect(jsonnetContent).toContain("text-bison-001");
        expect(jsonnetContent).toContain("vector search and generative agents");

        const originalPost = axios.post;
        axios.post = mock(async (url: string, body: any) => {
            return {
                data: {
                    candidates: [
                        {
                            output: "Verified output from Jsonnet prompt definition.",
                        },
                    ],
                },
            };
        }) as any;

        try {
            const palm2 = new Palm2AI({ apiKey: "test-jsonnet-key" });
            const output = await palm2.chat({
                model: "text-bison-001",
                prompt: "Explain how vector search and generative agents works in EdgeChains.",
            });

            expect(output).toBe("Verified output from Jsonnet prompt definition.");
        } finally {
            axios.post = originalPost;
        }
    });
});

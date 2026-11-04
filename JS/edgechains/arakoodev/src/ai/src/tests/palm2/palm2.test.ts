import path from "path";
import axios from "axios";
import { Palm2AI, loadJsonnetPrompts } from "../../lib/palm2/palm2";

describe("Palm2AI Google PaLM 2 endpoint (#279)", () => {
    const jsonnetPath = path.join(__dirname, "prompts.jsonnet");
    const prompts = loadJsonnetPrompts(jsonnetPath);

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("generates text completion using prompt loaded from Jsonnet", async () => {
        const postSpy = jest.spyOn(axios, "post").mockResolvedValueOnce({
            data: {
                candidates: [
                    {
                        output: "EdgeChains uses Jsonnet to manage prompt templates declaratively.",
                    },
                ],
            },
        } as any);

        const palm2 = new Palm2AI({ apiKey: "palm2-test-key" });
        const output = await palm2.generateText({
            prompt: prompts.textPrompt,
            temperature: 0.3,
            maxOutputTokens: 256,
        });

        expect(output).toBe("EdgeChains uses Jsonnet to manage prompt templates declaratively.");
        expect(postSpy).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=palm2-test-key",
            expect.objectContaining({
                prompt: { text: prompts.textPrompt },
                temperature: 0.3,
                maxOutputTokens: 256,
            }),
            expect.any(Object)
        );
    });

    test("generates multi-turn chat response using context and message from Jsonnet", async () => {
        const postSpy = jest.spyOn(axios, "post").mockResolvedValueOnce({
            data: {
                candidates: [
                    {
                        author: "assistant",
                        content: "PaLM 2 provides fast text, chat, and gecko embeddings.",
                    },
                ],
            },
        } as any);

        const palm2 = new Palm2AI({ apiKey: "palm2-test-key" });
        const reply = await palm2.chat({
            context: prompts.chatContext,
            messages: [{ author: "user", content: prompts.chatUserMessage }],
        });

        expect(reply).toBe("PaLM 2 provides fast text, chat, and gecko embeddings.");
        expect(postSpy).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage?key=palm2-test-key",
            expect.objectContaining({
                prompt: expect.objectContaining({
                    context: prompts.chatContext,
                    messages: [{ author: "user", content: prompts.chatUserMessage }],
                }),
            }),
            expect.any(Object)
        );
    });

    test("generates gecko embeddings using input text loaded from Jsonnet", async () => {
        const postSpy = jest.spyOn(axios, "post").mockResolvedValueOnce({
            data: {
                embedding: {
                    value: [0.11, -0.24, 0.89],
                },
            },
        } as any);

        const palm2 = new Palm2AI({ apiKey: "palm2-test-key" });
        const embedding = await palm2.generateEmbeddings({
            text: prompts.embeddingText,
        });

        expect(embedding).toEqual([0.11, -0.24, 0.89]);
        expect(postSpy).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText?key=palm2-test-key",
            { text: prompts.embeddingText },
            expect.any(Object)
        );
    });
});

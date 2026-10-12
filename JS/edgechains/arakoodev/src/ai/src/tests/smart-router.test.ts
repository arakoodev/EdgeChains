import axios from "axios";
import { SmartRouter } from "../lib/smart-router/smartRouter";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOpenAIReply(content: string) {
    return {
        data: {
            choices: [{ message: { role: "assistant", content } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        },
    };
}

function makeGeminiReply(content: string) {
    return {
        data: {
            candidates: [{ content: { parts: [{ text: content }], role: "model" } }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
        },
    };
}

function makeLlamaReply(content: string) {
    return {
        data: {
            choices: [{ message: { role: "assistant", content } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        },
    };
}

function makeCohereReply(content: string) {
    return {
        data: {
            text: content,
            meta: { tokens: { input_tokens: 10, output_tokens: 20 } },
        },
    };
}

// ---------------------------------------------------------------------------
// detectProvider
// ---------------------------------------------------------------------------

describe("SmartRouter.detectProvider", () => {
    const router = new SmartRouter();

    it("detects openai from gpt-* prefix", () => {
        expect(router.detectProvider("gpt-4o")).toBe("openai");
        expect(router.detectProvider("gpt-3.5-turbo")).toBe("openai");
        expect(router.detectProvider("o1-mini")).toBe("openai");
        expect(router.detectProvider("chatgpt-4o-latest")).toBe("openai");
    });

    it("detects gemini from gemini-* prefix", () => {
        expect(router.detectProvider("gemini-pro")).toBe("gemini");
        expect(router.detectProvider("gemini-1.5-flash")).toBe("gemini");
        expect(router.detectProvider("palm-2")).toBe("gemini");
    });

    it("detects llama from llama-* and meta-llama/ prefix", () => {
        expect(router.detectProvider("llama-3-70b")).toBe("llama");
        expect(router.detectProvider("meta-llama/Llama-3-8b")).toBe("llama");
        expect(router.detectProvider("mixtral-8x7b")).toBe("llama");
        expect(router.detectProvider("mistral-7b")).toBe("llama");
    });

    it("detects cohere from command-* prefix", () => {
        expect(router.detectProvider("command-r")).toBe("cohere");
        expect(router.detectProvider("command-r-plus")).toBe("cohere");
    });

    it("returns null for unknown model", () => {
        expect(router.detectProvider("unknown-model-xyz")).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// isModelSupported / listProviders
// ---------------------------------------------------------------------------

describe("SmartRouter utilities", () => {
    const router = new SmartRouter();

    it("isModelSupported returns true for known prefixes", () => {
        expect(router.isModelSupported("gpt-4o")).toBe(true);
        expect(router.isModelSupported("command-r")).toBe(true);
    });

    it("isModelSupported returns false for unknown models", () => {
        expect(router.isModelSupported("claude-3-opus")).toBe(false);
    });

    it("listProviders returns all four", () => {
        expect(router.listProviders()).toEqual(["openai", "gemini", "llama", "cohere"]);
    });
});

// ---------------------------------------------------------------------------
// chat — primary routing
// ---------------------------------------------------------------------------

describe("SmartRouter.chat — primary routing", () => {
    afterEach(() => jest.clearAllMocks());

    it("routes gpt-4o to OpenAI and returns content + usage", async () => {
        mockedAxios.post.mockResolvedValueOnce(makeOpenAIReply("Hello from OpenAI"));
        const router = new SmartRouter({ openaiApiKey: "sk-test" });
        const result = await router.chat({ model: "gpt-4o", prompt: "hi" });
        expect(result.provider).toBe("openai");
        expect(result.content).toBe("Hello from OpenAI");
        expect(result.usage?.total_tokens).toBe(30);
    });

    it("routes gemini-pro to Gemini", async () => {
        mockedAxios.post.mockResolvedValueOnce(makeGeminiReply("Hello from Gemini"));
        const router = new SmartRouter({ geminiApiKey: "gm-test" });
        const result = await router.chat({ model: "gemini-pro", prompt: "hi" });
        expect(result.provider).toBe("gemini");
        expect(result.content).toBe("Hello from Gemini");
    });

    it("routes llama-3 to Llama", async () => {
        mockedAxios.post.mockResolvedValueOnce(makeLlamaReply("Hello from Llama"));
        const router = new SmartRouter({ llamaApiKey: "ll-test" });
        const result = await router.chat({ model: "llama-3-70b", prompt: "hi" });
        expect(result.provider).toBe("llama");
        expect(result.content).toBe("Hello from Llama");
    });

    it("routes command-r to Cohere", async () => {
        mockedAxios.post.mockResolvedValueOnce(makeCohereReply("Hello from Cohere"));
        const router = new SmartRouter({ cohereApiKey: "co-test" });
        const result = await router.chat({ model: "command-r", prompt: "hi" });
        expect(result.provider).toBe("cohere");
        expect(result.content).toBe("Hello from Cohere");
    });
});

// ---------------------------------------------------------------------------
// chat — fallback chain
// ---------------------------------------------------------------------------

describe("SmartRouter.chat — fallback chain", () => {
    afterEach(() => jest.clearAllMocks());

    it("falls back to Gemini when OpenAI fails", async () => {
        mockedAxios.post
            .mockRejectedValueOnce(new Error("OpenAI 429"))
            .mockResolvedValueOnce(makeGeminiReply("Fallback from Gemini"));

        const router = new SmartRouter({ openaiApiKey: "sk-test", geminiApiKey: "gm-test" });
        const result = await router.chat({ model: "gpt-4o", prompt: "hi" });
        expect(result.provider).toBe("gemini");
        expect(result.content).toBe("Fallback from Gemini");
    });

    it("throws when all providers fail", async () => {
        mockedAxios.post.mockRejectedValue(new Error("network error"));
        const router = new SmartRouter({ openaiApiKey: "sk-test", geminiApiKey: "gm-test" });
        await expect(router.chat({ model: "gpt-4o", prompt: "hi" })).rejects.toThrow("SmartRouter: all providers failed");
    });

    it("skips providers with no API key configured", async () => {
        mockedAxios.post.mockResolvedValueOnce(makeGeminiReply("Gemini only"));
        // Only gemini key provided — openai should be skipped
        const router = new SmartRouter({ geminiApiKey: "gm-test" });
        const result = await router.chat({ model: "gpt-4o", prompt: "hi" });
        expect(result.provider).toBe("gemini");
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it("respects custom fallback chain order", async () => {
        mockedAxios.post
            .mockRejectedValueOnce(new Error("Cohere fail"))
            .mockResolvedValueOnce(makeOpenAIReply("OpenAI after cohere fail"));

        const router = new SmartRouter({
            openaiApiKey: "sk-test",
            cohereApiKey: "co-test",
            fallbackChain: ["cohere", "openai"],
        });
        const result = await router.chat({ model: "gpt-4o", prompt: "hi" });
        expect(result.provider).toBe("openai");
    });
});

// ---------------------------------------------------------------------------
// chat — message array support
// ---------------------------------------------------------------------------

describe("SmartRouter.chat — messages array", () => {
    afterEach(() => jest.clearAllMocks());

    it("accepts messages array instead of prompt", async () => {
        mockedAxios.post.mockResolvedValueOnce(makeOpenAIReply("ok"));
        const router = new SmartRouter({ openaiApiKey: "sk-test" });
        const result = await router.chat({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are helpful." },
                { role: "user", content: "Hello" },
            ],
        });
        expect(result.content).toBe("ok");
    });

    it("throws if neither prompt nor messages provided", async () => {
        const router = new SmartRouter({ openaiApiKey: "sk-test" });
        await expect(router.chat({ model: "gpt-4o" })).rejects.toThrow(
            "requires either `prompt` or `messages`"
        );
    });
});

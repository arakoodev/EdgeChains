import { afterEach, describe, expect, test, vi } from "vitest";
import { Stream } from "../lib/openai/openai.js";
import { MockAI, SmartRouter } from "../lib/router/index.js";

describe("Streaming (SmartRouter-backed Stream)", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test("OpenAIStream should return expected text via SmartRouter", async () => {
        const mockAI = new MockAI();
        mockAI.setBehavior("stream-default", {
            streamChunks: ["Hi! ", "How ", "can ", "I ", "help ", "you?."],
        });

        const router = new SmartRouter({
            deployments: [
                {
                    id: "stream-default",
                    modelName: "test_model",
                    provider: "openai",
                    model: "test_model",
                    apiKey: "test_api_key",
                },
            ],
            axiosInstance: mockAI.createAxiosInstance(),
        });

        const stream = new Stream({
            model: "test_model",
            OpenApiKey: "test_api_key",
            temperature: 0.7,
            max_tokens: 500,
            stream: true,
            router,
        });

        const streamReader = stream.OpenAIStream("hi").getReader();
        const text = await readStreamToString(streamReader);

        expect(text).toBe("Hi! How can I help you?.");
        expect(router.getTotalTokenUsage().total_tokens).toBeGreaterThan(0);
    });
});

async function readStreamToString(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const decodedValue = decoder.decode(value);
        if (decodedValue.includes("DONE")) break;
        text += JSON.parse(decodedValue)[0]["choices"][0]["delta"]["content"];
    }
    return text;
}

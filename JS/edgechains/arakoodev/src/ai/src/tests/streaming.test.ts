import { describe, expect, test } from "vitest";
import { SmartRouter } from "../lib/router/SmartRouter.js";
import { MockAI } from "../lib/router/MockAI.js";

describe("Streaming via SmartRouter", () => {
    test("SmartRouter streamChat should return expected streamed text", async () => {
        const mockAI = new MockAI({
            responsesByProvider: {
                openai: "Hi! How can I help you?.",
            },
        });
        const router = new SmartRouter({
            axiosInstance: mockAI.createAxiosInstance(),
            deployments: [
                {
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "test_api_key",
                },
            ],
        });

        const stream = await router.streamChat({ prompt: "hi" });
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let text = "";
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const decodedValue = decoder.decode(value);
            if (decodedValue.includes("[DONE]")) break;
            text += JSON.parse(decodedValue)[0]["choices"][0]["delta"]["content"];
        }

        expect(text).toBe("Hi! How can I help you?.");
    });
});

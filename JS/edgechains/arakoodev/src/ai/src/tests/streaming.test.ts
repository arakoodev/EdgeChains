import { describe, test, expect, beforeEach } from "vitest";
import { Router, MockLLM } from "../index.js";

describe("Streaming via Smart Router", () => {
    let mockLLM: MockLLM;

    beforeEach(() => {
        mockLLM = new MockLLM();
    });

    test("OpenAIStream / streamChat should stream expected text and record token usage", async () => {
        mockLLM.setScenario("test_api_key", {
            responseText: "Hi! How can I help you?.",
        });

        const router = new Router({
            model: "gpt-3.5-turbo",
            apiKey: "test_api_key",
            temperature: 0.7,
        });
        mockLLM.attach(router.httpClient);

        const stream = await router.OpenAIStream("hi");
        const streamReader = stream.getReader();
        const text = await readStreamToString(streamReader);

        expect(text).toBe("Hi! How can I help you?.");
        expect(router.getTokenUsage().total_tokens).toBeGreaterThan(0);
    });
});

async function readStreamToString(
    reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> {
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

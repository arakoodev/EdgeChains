import axios from "axios";
import { Stream } from "../lib/openai/streaming/OpenAiStreaming.js";

jest.mock("axios");

describe("Streaming", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("OpenAIStream returns a readable stream with the generated content", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({
            data: {
                choices: [{ message: { content: "Hi! How can I help you?." } }],
                usage: { total_tokens: 11 },
            },
        });

        const stream = new Stream({
            model: "test_model",
            OpenApiKey: "test_api_key",
            temperature: 0.7,
            stream: true,
        });

        const reader = (await stream.OpenAIStream("hi")).getReader();
        const text = await readStreamToString(reader);

        expect(text).toBe("Hi! How can I help you?.");
    });
});

async function readStreamToString(reader: ReadableStreamDefaultReader<Uint8Array>) {
    const decoder = new TextDecoder();
    let text = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        const decodedValue = decoder.decode(value);
        if (decodedValue.includes("DONE")) break;

        text += JSON.parse(decodedValue)[0]["choices"][0]["delta"]["content"];
    }

    return text;
}

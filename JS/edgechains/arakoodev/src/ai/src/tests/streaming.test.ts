import { describe, expect, test } from "vitest";
import { MockAI, SmartRouter, Stream } from "../index.js";

describe("Streaming via SmartRouter and Stream", () => {
    test("OpenAIStream should return expected streamed text", async () => {
        const mockAI = new MockAI();
        mockAI.registerResponse("test_model", {
            responseText: "Hi! How can I help you?.",
            streamChunks: ["Hi! ", "How ", "can ", "I ", "help ", "you?."],
        });

        const options = {
            model: "test_model",
            OpenApiKey: "test_api_key",
            temperature: 0.7,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            max_tokens: 500,
            stream: true,
            n: 1,
            adapter: mockAI.createAxiosAdapter(),
        };

        const stream = new Stream(options);
        const streamReader = stream.OpenAIStream("hi").getReader();
        const text = await readStreamToString(streamReader);

        expect(text).toBe("Hi! How can I help you?.");
    });

    test("SmartRouter.streamCompletion should stream across OpenAI, PaLM, and Cohere", async () => {
        const mockAI = new MockAI();
        mockAI.registerResponse("palm-stream", {
            responseText: "Streaming from Google PaLM",
            streamChunks: ["Streaming ", "from ", "Google ", "PaLM"],
        });

        const router = new SmartRouter({
            adapter: mockAI.createAxiosAdapter(),
            modelList: [
                {
                    deploymentId: "palm-stream",
                    modelName: "palm-model",
                    provider: "palm",
                    model: "text-bison-001",
                    apiKey: "palm_test_key",
                },
            ],
        });

        const receivedDeltas: string[] = [];
        for await (const chunk of router.streamCompletion({
            model: "palm-model",
            prompt: "Stream test",
        })) {
            if (chunk.delta) {
                receivedDeltas.push(chunk.delta);
            }
        }

        expect(receivedDeltas.join("")).toBe("Streaming from Google PaLM");
        const state = router.getDeploymentState("palm-stream");
        expect(state?.totalTokensUsed).toBeGreaterThan(0);
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
        if (decodedValue.includes("[DONE]")) break;
        text += JSON.parse(decodedValue)[0]["choices"][0]["delta"]["content"];
    }
    return text;
}

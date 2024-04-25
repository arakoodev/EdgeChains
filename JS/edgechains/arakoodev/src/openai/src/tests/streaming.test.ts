import { Stream } from "../../../../dist/openai/src/lib/streaming/OpenAiStreaming.js";
import { TextEncoder, TextDecoder } from 'text-decoding'
jest.mock("../lib/streaming/OpenAiStreaming.ts", () => {
  return {
    Stream: jest.fn().mockImplementation(() => ({
      OpenAIStream: jest.fn().mockImplementation((prompt) => {
        return new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                '[{"choices":[{"delta":{"content":"Hi! "}}]}]',
              ),
            );
            controller.enqueue(
              new TextEncoder().encode(
                '[{"choices":[{"delta":{"content":"How "}}]}]',
              ),
            );
            controller.enqueue(
              new TextEncoder().encode(
                '[{"choices":[{"delta":{"content":"can "}}]}]',
              ),
            );
            controller.enqueue(
              new TextEncoder().encode(
                '[{"choices":[{"delta":{"content":"I "}}]}]',
              ),
            );
            controller.enqueue(
              new TextEncoder().encode(
                '[{"choices":[{"delta":{"content":"help "}}]}]',
              ),
            );
            controller.enqueue(
              new TextEncoder().encode(
                '[{"choices":[{"delta":{"content":"you?."}}]}]',
              ),
            );
            controller.enqueue(new TextEncoder().encode("[DONE]"));
            controller.close();
          },
        });
      }),
    })),
  };
});

describe("Streaming", () => {
  afterEach(() => {
    jest.clearAllMocks(); // Clear mock function calls after each test
  });

  test("OpenAIStream should return expected text", async () => {
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
    };

    const stream = new Stream(options);

    //@ts-ignore
    const streamReader = await stream.OpenAIStream("hi").getReader();
    const text = await readStreamToString(streamReader);

    expect(text).toBe("Hi! How can I help you?.");
  });
});

async function readStreamToString(reader) {
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

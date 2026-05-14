import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Palm2AI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("generateText calls the text-bison endpoint with a text prompt", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { candidates: [{ output: "Test response" }] },
    });

    const palm2 = new Palm2AI({ apiKey: "test_api_key" });
    const response = await palm2.generateText({
      prompt: "Write a status update",
      temperature: 0.4,
      maxOutputTokens: 128,
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=test_api_key",
      {
        prompt: { text: "Write a status update" },
        temperature: 0.4,
        maxOutputTokens: 128,
      },
      { headers: { "Content-Type": "application/json" } },
    );
    expect(response.candidates[0].output).toBe("Test response");
  });

  test("generateMessage calls the chat-bison endpoint with normalized messages", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { candidates: [{ author: "1", content: "Hello" }] },
    });

    const palm2 = new Palm2AI({ apiKey: "test_api_key" });
    const response = await palm2.generateMessage({
      prompt: "hello",
      candidateCount: 1,
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage?key=test_api_key",
      {
        prompt: { messages: [{ content: "hello" }] },
        candidateCount: 1,
      },
      { headers: { "Content-Type": "application/json" } },
    );
    expect(response.candidates[0].content).toBe("Hello");
  });

  test("embedText calls the embedding endpoint", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { embedding: { value: [0.1, 0.2, 0.3] } },
    });

    const palm2 = new Palm2AI({ apiKey: "test_api_key" });
    const response = await palm2.embedText({ text: "embed this" });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText?key=test_api_key",
      { text: "embed this" },
      { headers: { "Content-Type": "application/json" } },
    );
    expect(response.embedding.value).toEqual([0.1, 0.2, 0.3]);
  });

  test("countMessageTokens calls the token endpoint", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { tokenCount: 7 } });

    const palm2 = new Palm2AI({ apiKey: "test_api_key" });
    const response = await palm2.countMessageTokens({
      prompt: [{ content: "How many tokens?" }],
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:countMessageTokens?key=test_api_key",
      { prompt: { messages: [{ content: "How many tokens?" }] } },
      { headers: { "Content-Type": "application/json" } },
    );
    expect(response.tokenCount).toBe(7);
  });
});

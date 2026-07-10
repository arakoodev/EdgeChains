import axios from "axios";
import { OpenAI } from "../lib/openai/openai";
import { SmartRouter } from "../lib/router/smartRouter";

jest.mock("axios");

describe("SmartRouter provider regressions", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("OpenAI payload omits the internal prompt field", () => {
    const router = new SmartRouter({
      deployments: [
        {
          id: "openai-dep",
          provider: "openai",
          apiKey: "sk-openai",
          model: "gpt-4",
        },
      ],
    });

    const deployment = (router as any).deployments[0];
    const payload = (router as any).payloadFor(deployment, {
      prompt: "hello",
      stream: true,
      temperature: 0,
    });

    expect(payload).toEqual({
      model: "gpt-4",
      messages: [{ role: "user", content: "hello" }],
      stream: true,
      temperature: 0,
    });
    expect(payload).not.toHaveProperty("prompt");
  });

  test("Cohere usage includes both input and output tokens", async () => {
    const router = new SmartRouter({
      deployments: [
        {
          id: "cohere-dep",
          provider: "cohere",
          apiKey: "cohere-key",
          handler: jest.fn().mockResolvedValue({
            text: "cohere response",
            meta: {
              billed_units: {
                input_tokens: 8,
                output_tokens: 4,
              },
            },
          }),
        },
      ],
    });

    const response = await router.chat({ prompt: "hello" });

    expect(response.usage).toEqual({
      prompt_tokens: 8,
      completion_tokens: 4,
      total_tokens: 12,
    });
    expect(router.getUsage("cohere-dep")).toBe(12);
  });

  test("OpenAI compatibility facade sends a sanitized request body", async () => {
    (axios.post as jest.Mock).mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "ok" } }],
        usage: { total_tokens: 1 },
      },
    });

    const client = new OpenAI({ apiKey: "test-key", orgId: "test-org" });
    await client.chat({
      prompt: "hello",
      model: "gpt-4",
      max_tokens: 64,
      temperature: 0,
      frequency_penalty: 0,
    });

    const requestBody = (axios.post as jest.Mock).mock.calls[0][1];
    expect(requestBody).toEqual({
      model: "gpt-4",
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 64,
      temperature: 0,
      frequency_penalty: 0,
    });
    expect(requestBody).not.toHaveProperty("prompt");
  });

  test("Retry-After works with AxiosHeaders-style access", async () => {
    let now = 1000;
    const rateLimited = jest.fn().mockRejectedValue({
      response: {
        status: 429,
        headers: {
          get: (name: string) =>
            name === "retry-after" ? "2" : null,
        },
      },
    });
    const fallback = jest.fn().mockResolvedValue({
      content: "fallback",
      usage: { total_tokens: 1 },
    });

    const router = new SmartRouter({
      now: () => now,
      deployments: [
        {
          id: "limited",
          provider: "openai",
          apiKey: "key",
          handler: rateLimited,
        },
        {
          id: "fallback",
          provider: "openai",
          apiKey: "key",
          tokenUsage: 1,
          handler: fallback,
        },
      ],
    });

    const response = await router.chat({ prompt: "hello" });

    expect(response.deploymentId).toBe("fallback");
    expect(router.getRateLimitedUntil("limited")).toBe(3000);
    now = 3000;
    expect(router.getRateLimitedUntil("limited")).toBe(now);
  });
});

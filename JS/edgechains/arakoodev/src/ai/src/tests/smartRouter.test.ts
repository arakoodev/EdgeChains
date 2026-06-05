import { SmartRouter } from "../lib/router/smartRouter";

describe("SmartRouter", () => {
  test("routes to the available deployment with the least token usage", async () => {
    const router = new SmartRouter({
      deployments: [
        {
          id: "openai-busy",
          provider: "openai",
          apiKey: "openai-key",
          tokenLimit: 100,
          tokenUsage: 80,
          handler: jest.fn().mockResolvedValue({
            content: "busy deployment",
            usage: { total_tokens: 10 },
          }),
        },
        {
          id: "cohere-idle",
          provider: "cohere",
          apiKey: "cohere-key",
          tokenLimit: 100,
          tokenUsage: 10,
          handler: jest.fn().mockResolvedValue({
            content: "idle deployment",
            usage: { total_tokens: 5 },
          }),
        },
      ],
    });

    const response = await router.chat({ prompt: "hello" });

    expect(response.content).toBe("idle deployment");
    expect(response.deploymentId).toBe("cohere-idle");
    expect(router.getUsage("cohere-idle")).toBe(15);
  });

  test("retries rate limited deployments and records logging callbacks", async () => {
    const onLog = jest.fn();
    const rateLimitedHandler = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 429 } });
    const fallbackHandler = jest.fn().mockResolvedValue({
      content: "fallback response",
      usage: { total_tokens: 7 },
    });

    const router = new SmartRouter({
      retries: 0,
      deployments: [
        {
          id: "openai-limited",
          provider: "openai",
          apiKey: "openai-key",
          tokenLimit: 100,
          tokenUsage: 0,
          handler: rateLimitedHandler,
        },
        {
          id: "google-fallback",
          provider: "google",
          apiKey: "google-key",
          tokenLimit: 100,
          tokenUsage: 0,
          handler: fallbackHandler,
        },
      ],
      callbacks: {
        sentry: onLog,
        posthog: onLog,
      },
    });

    const response = await router.chat({ prompt: "retry me" });

    expect(response.content).toBe("fallback response");
    expect(response.deploymentId).toBe("google-fallback");
    expect(rateLimitedHandler).toHaveBeenCalledTimes(1);
    expect(fallbackHandler).toHaveBeenCalledTimes(1);
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "deployment_rate_limited",
        deploymentId: "openai-limited",
      }),
    );
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "deployment_success",
        deploymentId: "google-fallback",
      }),
    );
  });

  test("passes streaming requests through the selected deployment", async () => {
    async function* chunks() {
      yield "first";
      yield "second";
    }

    const router = new SmartRouter({
      deployments: [
        {
          id: "openai-stream",
          provider: "openai",
          apiKey: "openai-key",
          tokenLimit: 100,
          tokenUsage: 0,
          handler: jest.fn().mockResolvedValue(chunks()),
        },
      ],
    });

    const stream = await router.stream({ prompt: "stream" });
    const received: string[] = [];

    for await (const chunk of stream) {
      received.push(String(chunk));
    }

    expect(received).toEqual(["first", "second"]);
  });
});

import { SmartRouter } from "../lib/router/smartRouter";

describe("SmartRouter reliability", () => {
  test("keeps a rate-limited deployment on cooldown across requests", async () => {
    let now = 1000;
    const limited = jest.fn().mockRejectedValue({
      response: { status: 429, headers: { "retry-after": "2" } },
    });
    const fallback = jest.fn().mockResolvedValue({
      content: "fallback",
      usage: { total_tokens: 1 },
    });
    const router = new SmartRouter({
      retries: 0,
      now: () => now,
      deployments: [
        {
          id: "limited",
          provider: "openai",
          apiKey: "key",
          handler: limited,
        },
        {
          id: "fallback",
          provider: "google",
          apiKey: "key",
          tokenUsage: 10,
          handler: fallback,
        },
      ],
    });

    await router.chat({ prompt: "first" });
    expect(router.getRateLimitedUntil("limited")).toBe(3000);

    await router.chat({ prompt: "second" });
    expect(limited).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(2);

    now = 3001;
    limited.mockResolvedValueOnce({
      content: "recovered",
      usage: { total_tokens: 1 },
    });
    const recovered = await router.chat({ prompt: "third" });
    expect(recovered.deploymentId).toBe("limited");
  });

  test("times out custom handlers and fails over", async () => {
    const never = new Promise(() => undefined);
    const fallback = jest.fn().mockResolvedValue({
      content: "after timeout",
      usage: { total_tokens: 1 },
    });
    const router = new SmartRouter({
      retries: 0,
      timeoutMs: 5,
      deployments: [
        {
          id: "slow",
          provider: "openai",
          apiKey: "key",
          handler: jest.fn().mockReturnValue(never),
        },
        {
          id: "fallback",
          provider: "cohere",
          apiKey: "key",
          tokenUsage: 1,
          handler: fallback,
        },
      ],
    });

    const response = await router.chat({ prompt: "hello" });
    expect(response.deploymentId).toBe("fallback");
    expect(response.content).toBe("after timeout");
  });

  test("observability callback errors never break successful routing", async () => {
    const posthog = jest.fn();
    const router = new SmartRouter({
      deployments: [
        {
          id: "healthy",
          provider: "openai",
          apiKey: "key",
          handler: jest.fn().mockResolvedValue({
            content: "ok",
            usage: { total_tokens: 1 },
          }),
        },
      ],
      callbacks: {
        sentry: () => {
          throw new Error("sentry unavailable");
        },
        posthog,
      },
    });

    await expect(router.chat({ prompt: "hello" })).resolves.toMatchObject({
      content: "ok",
    });
    expect(posthog).toHaveBeenCalled();
  });

  test("rejects duplicate deployment ids and invalid numeric options", () => {
    expect(
      () =>
        new SmartRouter({
          deployments: [
            { id: "same", provider: "openai", apiKey: "a" },
            { id: "same", provider: "cohere", apiKey: "b" },
          ],
        }),
    ).toThrow("Duplicate SmartRouter deployment id");

    expect(
      () =>
        new SmartRouter({
          retries: -1,
          deployments: [{ id: "one", provider: "openai", apiKey: "a" }],
        }),
    ).toThrow("retries must be non-negative");
  });

  test("requires streaming deployments to return an async iterable", async () => {
    const router = new SmartRouter({
      retries: 0,
      deployments: [
        {
          id: "bad-stream",
          provider: "openai",
          apiKey: "key",
          handler: jest.fn().mockResolvedValue({ content: "not a stream" }),
        },
      ],
    });

    await expect(router.stream({ prompt: "hello" })).rejects.toThrow(
      "did not return an async iterable",
    );
  });

  test("maps Google multi-message requests and streaming endpoints", () => {
    const router = new SmartRouter({
      deployments: [
        {
          id: "google",
          provider: "google",
          apiKey: "key",
          model: "gemini-1.5-pro",
        },
      ],
    });
    const deployment = (router as any).deployments[0];

    expect((router as any).endpointFor(deployment, { stream: true })).toBe(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:streamGenerateContent?alt=sse",
    );
    expect(
      (router as any).payloadFor(deployment, {
        messages: [
          { role: "user", content: "question" },
          { role: "assistant", content: "answer" },
        ],
      }),
    ).toEqual({
      contents: [
        { role: "user", parts: [{ text: "question" }] },
        { role: "model", parts: [{ text: "answer" }] },
      ],
    });
  });
});

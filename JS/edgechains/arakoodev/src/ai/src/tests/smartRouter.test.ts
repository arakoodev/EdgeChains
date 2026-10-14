import {
  SmartRouter,
  createSmartRouterFromConfig,
} from "../lib/router/smartRouter";

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

  test("skips deployments that have reached their tokenLimit", async () => {
    const handler = jest.fn().mockResolvedValue({
      content: "response",
      usage: { total_tokens: 1 },
    });

    const router = new SmartRouter({
      deployments: [
        {
          id: "over-limit",
          provider: "openai",
          apiKey: "key",
          tokenLimit: 100,
          tokenUsage: 100,
          handler,
        },
        {
          id: "under-limit",
          provider: "openai",
          apiKey: "key",
          tokenLimit: 100,
          tokenUsage: 0,
          handler,
        },
      ],
    });

    const response = await router.chat({ prompt: "hello" });

    expect(response.deploymentId).toBe("under-limit");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("retries non-429 errors up to the configured retry count", async () => {
    const flakyHandler = jest
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({
        content: "success after retries",
        usage: { total_tokens: 3 },
      });

    const router = new SmartRouter({
      retries: 2,
      deployments: [
        {
          id: "flaky",
          provider: "openai",
          apiKey: "key",
          handler: flakyHandler,
        },
      ],
    });

    const response = await router.chat({ prompt: "hello" });

    expect(response.content).toBe("success after retries");
    expect(flakyHandler).toHaveBeenCalledTimes(3);
  });

  test("429 failover switches to the next deployment instead of retrying the same one", async () => {
    const rateLimitedHandler = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 429 } });
    const fallbackHandler = jest.fn().mockResolvedValue({
      content: "fallback response",
      usage: { total_tokens: 7 },
    });

    const router = new SmartRouter({
      retries: 2,
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
    });

    const response = await router.chat({ prompt: "retry me" });

    expect(response.content).toBe("fallback response");
    expect(response.deploymentId).toBe("google-fallback");
    expect(rateLimitedHandler).toHaveBeenCalledTimes(1);
    expect(fallbackHandler).toHaveBeenCalledTimes(1);
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

  test("sentry and posthog callbacks are called independently", async () => {
    const sentryLog = jest.fn();
    const posthogLog = jest.fn();
    const handler = jest.fn().mockResolvedValue({
      content: "ok",
      usage: { total_tokens: 1 },
    });

    const router = new SmartRouter({
      deployments: [
        {
          id: "dep",
          provider: "openai",
          apiKey: "key",
          handler,
        },
      ],
      callbacks: {
        sentry: sentryLog,
        posthog: posthogLog,
      },
    });

    await router.chat({ prompt: "hello" });

    expect(sentryLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "deployment_success" }),
    );
    expect(posthogLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "deployment_success" }),
    );
  });

  test("normalizes OpenAI response shape", async () => {
    const handler = jest.fn().mockResolvedValue({
      choices: [{ message: { content: "openai msg" } }],
      usage: { total_tokens: 42 },
    });

    const router = new SmartRouter({
      deployments: [
        {
          id: "openai-dep",
          provider: "openai",
          apiKey: "key",
          handler,
        },
      ],
    });

    const response = await router.chat({ prompt: "hi" });

    expect(response.content).toBe("openai msg");
    expect(response.usage?.total_tokens).toBe(42);
  });

  test("normalizes Google response shape", async () => {
    const handler = jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "google msg" }] } }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    });

    const router = new SmartRouter({
      deployments: [
        {
          id: "google-dep",
          provider: "google",
          apiKey: "key",
          handler,
        },
      ],
    });

    const response = await router.chat({ prompt: "hi" });

    expect(response.content).toBe("google msg");
    expect(response.usage?.total_tokens).toBe(15);
    expect(response.usage?.prompt_tokens).toBe(10);
    expect(response.usage?.completion_tokens).toBe(5);
  });

  test("normalizes Cohere response shape", async () => {
    const handler = jest.fn().mockResolvedValue({
      text: "cohere msg",
      meta: {
        billed_units: {
          input_tokens: 8,
          output_tokens: 4,
        },
      },
    });

    const router = new SmartRouter({
      deployments: [
        {
          id: "cohere-dep",
          provider: "cohere",
          apiKey: "key",
          handler,
        },
      ],
    });

    const response = await router.chat({ prompt: "hi" });

    expect(response.content).toBe("cohere msg");
    expect(response.usage?.total_tokens).toBe(12);
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

  test("createSmartRouterFromConfig builds a working router", async () => {
    const handler = jest.fn().mockResolvedValue({
      content: "config-driven",
      usage: { total_tokens: 2 },
    });

    const router = createSmartRouterFromConfig({
      deployments: [
        {
          id: "cfg-dep",
          provider: "openai",
          apiKey: "key",
          handler,
        },
      ],
      retries: 1,
      timeoutMs: 5000,
    });

    const response = await router.chat({ prompt: "hello" });

    expect(response.content).toBe("config-driven");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("OpenAI provider uses correct endpoint, headers, and payload", () => {
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
    const endpoint = (router as any).endpointFor(deployment);
    const headers = (router as any).headersFor(deployment);
    const payload = (router as any).payloadFor(deployment, {
      prompt: "hello",
      stream: true,
    });

    expect(endpoint).toBe("https://api.openai.com/v1/chat/completions");
    expect(headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer sk-openai",
    });
    expect(payload).toEqual({
      model: "gpt-4",
      messages: [{ role: "user", content: "hello" }],
      stream: true,
    });
  });

  test("Google provider uses correct endpoint, headers, and payload", () => {
    const router = new SmartRouter({
      deployments: [
        {
          id: "google-dep",
          provider: "google",
          apiKey: "sk-google",
        },
      ],
    });

    const deployment = (router as any).deployments[0];
    const endpoint = (router as any).endpointFor(deployment);
    const headers = (router as any).headersFor(deployment);
    const payload = (router as any).payloadFor(deployment, {
      prompt: "hello",
    });

    expect(endpoint).toBe(
      "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
    );
    expect(headers).toEqual({
      "Content-Type": "application/json",
      "x-goog-api-key": "sk-google",
    });
    expect(payload).toEqual({
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
    });
  });

  test("Cohere provider uses correct endpoint, headers, and payload", () => {
    const router = new SmartRouter({
      deployments: [
        {
          id: "cohere-dep",
          provider: "cohere",
          apiKey: "sk-cohere",
          model: "command-r",
        },
      ],
    });

    const deployment = (router as any).deployments[0];
    const endpoint = (router as any).endpointFor(deployment);
    const headers = (router as any).headersFor(deployment);
    const payload = (router as any).payloadFor(deployment, {
      prompt: "hello",
      stream: true,
    });

    expect(endpoint).toBe("https://api.cohere.ai/v1/chat");
    expect(headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer sk-cohere",
    });
    expect(payload).toEqual({
      model: "command-r",
      message: "hello",
      stream: true,
    });
  });

  test("custom baseUrl overrides provider default endpoint", () => {
    const router = new SmartRouter({
      deployments: [
        {
          id: "custom-dep",
          provider: "openai",
          apiKey: "sk-custom",
          baseUrl: "https://custom.example.com/v1/chat",
        },
      ],
    });

    const deployment = (router as any).deployments[0];
    const endpoint = (router as any).endpointFor(deployment);

    expect(endpoint).toBe("https://custom.example.com/v1/chat");
  });
});

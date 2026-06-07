import { SmartRouter } from "../lib/router/smartRouter";

describe("SmartRouter streaming compatibility", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("streams OpenAI-style SSE chunks through SmartRouter", async () => {
    async function* openAIChunks() {
      yield { choices: [{ delta: { content: "Hi! " } }] };
      yield { choices: [{ delta: { content: "How " } }] };
      yield { choices: [{ delta: { content: "can " } }] };
      yield { choices: [{ delta: { content: "I " } }] };
      yield { choices: [{ delta: { content: "help " } }] };
      yield { choices: [{ delta: { content: "you?" } }] };
    }

    const router = new SmartRouter({
      deployments: [
        {
          id: "openai-stream",
          provider: "openai",
          apiKey: "test-key",
          tokenLimit: 100,
          tokenUsage: 0,
          handler: jest.fn().mockResolvedValue(openAIChunks()),
        },
      ],
    });

    const stream = await router.stream({ prompt: "hi" });
    const received: string[] = [];

    for await (const chunk of stream) {
      const c = chunk as any;
      received.push(c.choices?.[0]?.delta?.content ?? "");
    }

    expect(received.join("")).toBe("Hi! How can I help you?");
  });

  test("streams Google-style chunks through SmartRouter", async () => {
    async function* googleChunks() {
      yield { candidates: [{ content: { parts: [{ text: "Hello " }] } }] };
      yield { candidates: [{ content: { parts: [{ text: "from " }] } }] };
      yield { candidates: [{ content: { parts: [{ text: "Google." }] } }] };
    }

    const router = new SmartRouter({
      deployments: [
        {
          id: "google-stream",
          provider: "google",
          apiKey: "test-key",
          tokenLimit: 100,
          tokenUsage: 0,
          handler: jest.fn().mockResolvedValue(googleChunks()),
        },
      ],
    });

    const stream = await router.stream({ prompt: "hi" });
    const received: string[] = [];

    for await (const chunk of stream) {
      const c = chunk as any;
      received.push(c.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    }

    expect(received.join("")).toBe("Hello from Google.");
  });

  test("streams Cohere-style chunks through SmartRouter", async () => {
    async function* cohereChunks() {
      yield { text: "Cohere " };
      yield { text: "response." };
    }

    const router = new SmartRouter({
      deployments: [
        {
          id: "cohere-stream",
          provider: "cohere",
          apiKey: "test-key",
          tokenLimit: 100,
          tokenUsage: 0,
          handler: jest.fn().mockResolvedValue(cohereChunks()),
        },
      ],
    });

    const stream = await router.stream({ prompt: "hi" });
    const received: string[] = [];

    for await (const chunk of stream) {
      const c = chunk as any;
      received.push(c.text ?? "");
    }

    expect(received.join("")).toBe("Cohere response.");
  });
});

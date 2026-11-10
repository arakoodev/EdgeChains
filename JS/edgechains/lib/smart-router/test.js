import assert from "node:assert";
import { SmartRouter, SentryLogger, PostHogLogger } from "./index.js";

async function runTests() {
  const sentry = new SentryLogger({ dsn: "https://sentry.example.io/1" });
  const posthog = new PostHogLogger({ apiKey: "phc_test_123" });

  const router = SmartRouter.fromJsonnetConfig({
    maxRetries: 2,
    timeoutMs: 2000,
    sentry,
    posthog,
    deployments: [
      {
        id: "openai-primary",
        provider: "openai",
        model: "gpt-4o",
        rateLimitRpm: 10,
        rateLimitTpm: 10000,
        tokensUsed: 500,
        transport: async () => ({
          choices: [{ message: { content: "Response from OpenAI primary" } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      },
      {
        id: "palm-least-used",
        provider: "palm",
        model: "text-bison-001",
        rateLimitRpm: 10,
        rateLimitTpm: 10000,
        tokensUsed: 100,
        transport: async () => ({
          candidates: [{ output: "Response from Google PaLM deployment" }],
        }),
      },
      {
        id: "cohere-backup",
        provider: "cohere",
        model: "command",
        rateLimitRpm: 10,
        rateLimitTpm: 10000,
        tokensUsed: 250,
        transport: async () => ({
          generations: [{ text: "Response from Cohere deployment" }],
        }),
      },
    ],
  });

  // 1. Picks least tokensUsed deployment ("palm-least-used" has 100 vs 250 and 500)
  const first = await router.complete({ prompt: "Explain EdgeChains routing" });
  assert.strictEqual(first.deploymentId, "palm-least-used");
  assert.strictEqual(first.provider, "palm");
  assert.strictEqual(first.content, "Response from Google PaLM deployment");
  assert.ok(first.usage.total_tokens > 0);
  assert.strictEqual(posthog.events.length, 1);

  // 2. Failover + Sentry logging when primary deployment fails
  router.deployments[1].transport = async () => {
    throw new Error("503 PaLM overloaded");
  };
  const second = await router.complete({ prompt: "Test failover to Cohere" });
  assert.strictEqual(second.deploymentId, "cohere-backup");
  assert.strictEqual(second.provider, "cohere");
  assert.strictEqual(sentry.events.length, 1);
  assert.strictEqual(sentry.events[0].deploymentId, "palm-least-used");

  // 3. Streaming capability
  const chunks = [];
  for await (const part of router.streamComplete({
    provider: "openai",
    prompt: "Stream test",
  })) {
    if (!part.done) chunks.push(part.delta);
  }
  assert.strictEqual(chunks.join(""), "Response from OpenAI primary");

  console.log("ALL SMART ROUTER TESTS PASSED");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

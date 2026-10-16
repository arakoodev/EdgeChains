import { SmartRouter } from "../../../arakoodev/src/ai/src/lib/router/SmartRouter.js";
import { Logger } from "../../../arakoodev/src/ai/src/lib/router/middleware/logger.js";

const router = new SmartRouter([
  { provider: "openai", model: "gpt-3.5-turbo", weight: 2, rateLimitRPM: 60 },
  { provider: "gemini", model: "gemini-pro", weight: 1, rateLimitRPM: 30 },
  { provider: "cohere", model: "command-r", weight: 1, rateLimitRPM: 40 },
]);

router.useLogger(router.getLogger().sentryLog());

router.useLogger(router.getLogger().posthogLog());

async function main() {
  const result = await router.chat({
    prompt: "What is the capital of France?",
    temperature: 0.3,
    maxTokens: 256,
  });
  console.log("Response:", result.content);
  console.log("Usage:", result.usage);
  console.log("Total deployments:", router.getDeployments().length);
}

main().catch(console.error);

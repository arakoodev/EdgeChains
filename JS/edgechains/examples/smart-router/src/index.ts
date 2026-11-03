import path from "path";
import { fileURLToPath } from "url";
import Jsonnet from "@arakoodev/jsonnet";
import { Router } from "@arakoodev/edgechains.js/ai";
import { ExampleMockServer } from "./mock-server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnet = new Jsonnet();

const secrets = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
);
let openaiKey: string = process.env.OPENAI_API_KEY || secrets.openai_api_key;
let cohereKey: string = process.env.COHERE_API_KEY || secrets.cohere_api_key;

// Offline demo mode: no real keys configured -> serve every deployment from a local mock.
let mockUrl = "";
if (openaiKey.includes("REPLACE") && !process.env.OPENAI_API_KEY) {
    const mock = new ExampleMockServer();
    mockUrl = await mock.start();
    openaiKey = "mock-openai-key";
    cohereKey = "mock-cohere-key";
    console.log("[demo] no API keys found - running against the offline mock server\n");
}

jsonnet.extString("openai_api_key", openaiKey);
jsonnet.extString("cohere_api_key", cohereKey);
const config = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/router.jsonnet"))
);
if (mockUrl) {
    for (const d of config.deployments) {
        d.apiBase =
            d.provider === "palm" || d.provider === "google"
                ? `${mockUrl}/palm/v1beta2`
                : mockUrl;
    }
}

// Build the router from Jsonnet configuration.
const router = await Router.fromJsonnet(config);

// Observability callbacks: wire these to Sentry / PostHog in production, e.g.
//   onSuccess: (e) => Sentry.captureMessage(`llm.success ${e.deployment}`, { extra: e })
//   onFailure: (e) => Sentry.captureException(new Error(e.error)),
//   onSuccess: (e) => posthog.capture("llm.success", e)
router.onSuccess = (e) =>
    console.log(
        `  [success] ${e.deployment} (${e.provider}) attempts=${e.attempts} tokens=${e.usage.totalTokens} latency=${e.latencyMs}ms`
    );
router.onFailure = (e) => console.log(`  [failure] ${e.deployment}: ${e.error} -> failing over`);

console.log("=== Load balancing + 429 failover (5 chat calls) ===");
for (let i = 1; i <= 5; i++) {
    const { content } = await router.chat({ prompt: `demo question ${i}` });
    console.log(`  reply ${i}: ${content}`);
}

console.log("\n=== Streaming ===");
let streamed = "";
for await (const chunk of router.streamCompletion({ prompt: "stream me please" })) {
    streamed += chunk;
}
console.log(`  streamed: ${streamed}`);

console.log("\n=== Live deployment stats (RPM/TPM rolling window, tokens, cooldown) ===");
console.table(router.getDeployments());
console.log("Global token usage:", router.getGlobalUsage());

if (mockUrl) {
    console.log("\n[demo] done - set OPENAI_API_KEY / COHERE_API_KEY to run against live APIs.");
}

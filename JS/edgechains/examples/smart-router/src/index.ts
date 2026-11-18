import { SmartRouter, createSentryCallback, createPostHogCallback } from "@arakoodev/edgechains.js/ai";
import type { RouterConfig } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import fileURLToPath from "file-uri-to-path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    // 1. Load configuration from jsonnet
    const jsonnet = new Jsonnet();

    // Read secrets
    const secrets = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
    );

    // Pass API keys to router config
    jsonnet.extString("openai_api_key", secrets.openai_api_key || process.env.OPENAI_API_KEY || "");
    jsonnet.extString("gemini_api_key", secrets.gemini_api_key || process.env.GEMINI_API_KEY || "");
    jsonnet.extString("cohere_api_key", secrets.cohere_api_key || process.env.COHERE_API_KEY || "");

    const routerConfig = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/router-config.jsonnet"))
    ) as RouterConfig;

    // 2. Create the SmartRouter from jsonnet config
    const router = SmartRouter.fromConfig(routerConfig);

    // 3. Add logging callbacks
    router.addCallback(
        createSentryCallback({ dsn: process.env.SENTRY_DSN || "https://example@sentry.io/1" })
    );
    router.addCallback(
        createPostHogCallback({
            apiKey: process.env.POSTHOG_API_KEY || "phc_example",
            host: "https://app.posthog.com",
        })
    );

    console.log("SmartRouter initialized with", routerConfig.deployments.length, "deployments");
    console.log("Strategy:", routerConfig.strategy);
    console.log();

    // 4. Basic chat — router picks the best deployment automatically
    console.log("--- Basic Chat ---");
    try {
        const response = await router.chat({
            prompt: "What is the capital of France? Reply in one sentence.",
            maxTokens: 100,
        });
        console.log(`Provider: ${response.provider} (${response.model})`);
        console.log(`Response: ${response.content}`);
        console.log(`Tokens: ${JSON.stringify(response.usage)}`);
    } catch (error: any) {
        console.log("Chat error:", error.message);
    }
    console.log();

    // 5. Multi-turn conversation
    console.log("--- Multi-turn Chat ---");
    try {
        const response = await router.chat({
            messages: [
                { role: "system", content: "You are a helpful geography teacher." },
                { role: "user", content: "Name three countries in South America." },
            ],
            maxTokens: 150,
        });
        console.log(`Provider: ${response.provider}`);
        console.log(`Response: ${response.content}`);
    } catch (error: any) {
        console.log("Multi-turn error:", error.message);
    }
    console.log();

    // 6. Streaming
    console.log("--- Streaming Chat ---");
    try {
        process.stdout.write("Stream: ");
        for await (const chunk of router.streamChat({ prompt: "Count from 1 to 5." })) {
            process.stdout.write(chunk.content);
        }
        console.log();
    } catch (error: any) {
        console.log("Stream error:", error.message);
    }
    console.log();

    // 7. Token usage stats
    console.log("--- Usage Statistics ---");
    const stats = router.getUsageStats();
    for (const s of stats) {
        console.log(
            `  ${s.provider}/${s.model}: ${s.totalRequests} requests, ` +
                `${s.totalTokensUsed} tokens, ${s.failures} failures`
        );
    }
    const total = router.getTotalUsage();
    console.log(`  Total tokens: ${total.totalTokens}`);
}

main().catch(console.error);

/**
 * Smart Router Example
 *
 * Demonstrates how to use the EdgeChains Smart Router to load balance
 * across multiple LLM providers with automatic fallback, streaming,
 * token tracking, and observability.
 */

import { LLMRouter } from "@arakoodev/edgechains.js/ai";
import type { RouterChatResponse, StreamChunk } from "@arakoodev/edgechains.js/ai";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    // ─── Initialize the Router ───────────────────────────────────

    const router = new LLMRouter({
        strategy: "least-busy",
        maxRetries: 3,
        timeout: 60000,
        trackTokenUsage: true,
        logging: {
            logRequests: true,
            logTokenUsage: true,
            logErrors: true,
        },
        deployments: [
            // Primary: OpenAI GPT-4o
            {
                id: "openai-gpt4o",
                provider: "openai",
                model: "gpt-4o",
                apiKey: process.env.OPENAI_API_KEY || "mock-key",
                baseUrl: process.env.OPENAI_BASE_URL || "http://localhost:4010/v1/chat/completions",
                orgId: process.env.OPENAI_ORG_ID,
                rpm: 500,
                isFallback: false,
                healthy: true,
                weight: 3,
            },
            // Primary: Gemini Pro
            {
                id: "gemini-pro",
                provider: "gemini",
                model: "gemini-pro",
                apiKey: process.env.GEMINI_API_KEY || "mock-key",
                baseUrl: process.env.GEMINI_BASE_URL || "http://localhost:4010/v1",
                rpm: 60,
                isFallback: false,
                healthy: true,
                weight: 1,
            },
            // Primary: Cohere Command-R
            {
                id: "cohere-command-r",
                provider: "cohere",
                model: "command-r",
                apiKey: process.env.COHERE_API_KEY || "mock-key",
                baseUrl: process.env.COHERE_BASE_URL || "http://localhost:4010/v2/chat",
                rpm: 100,
                isFallback: false,
                healthy: true,
                weight: 1,
            },
            // Fallback: OpenAI GPT-3.5-turbo
            {
                id: "openai-fallback",
                provider: "openai",
                model: "gpt-3.5-turbo",
                apiKey: process.env.OPENAI_API_KEY || "mock-key",
                baseUrl: process.env.OPENAI_BASE_URL || "http://localhost:4010/v1/chat/completions",
                orgId: process.env.OPENAI_ORG_ID,
                isFallback: true,
                healthy: true,
            },
        ],
    });

    // ─── Register Event Handlers ─────────────────────────────────

    router.onEvent((event) => {
        if (event.type === "request_success") {
            console.log(
                `✅ Request completed — deployment: ${event.deploymentId}, ` +
                `model: ${event.model}, latency: ${event.latencyMs}ms, ` +
                `tokens: ${event.usage.totalTokens}`
            );
        } else if (event.type === "fallback_triggered") {
            console.log(
                `⚠️ Fallback triggered: ${event.fromDeploymentId} → ${event.toDeploymentId} ` +
                `(${event.reason})`
            );
        }
    });

    // ─── Example 1: Basic Chat ───────────────────────────────────

    console.log("\n━━━ Example 1: Basic Chat ━━━\n");

    const response: RouterChatResponse = await router.chat({
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Explain quantum computing in one paragraph." },
        ],
        max_tokens: 256,
        temperature: 0.7,
    });

    console.log(`Provider: ${response.provider}`);
    console.log(`Model: ${response.model}`);
    console.log(`Deployment: ${response.deploymentId}`);
    console.log(`Tokens: ${response.usage.totalTokens}`);
    console.log(`Response: ${response.content}\n`);

    // ─── Example 2: Streaming Chat ───────────────────────────────

    console.log("\n━━━ Example 2: Streaming Chat ━━━\n");

    process.stdout.write("Streaming: ");
    for await (const chunk of router.streamChat({
        messages: [{ role: "user", content: "Count from 1 to 5." }],
        max_tokens: 128,
    })) {
        if (chunk.done) {
            console.log(`\n[Stream completed — finish reason: ${chunk.finishReason}]`);
        } else {
            process.stdout.write(chunk.content);
        }
    }
    console.log();

    // ─── Example 3: Specific Model Selection ─────────────────────

    console.log("\n━━━ Example 3: Model Override ━━━\n");

    const geminiResponse = await router.chat({
        messages: [{ role: "user", content: "What is the speed of light?" }],
        model: "gemini-pro",
        max_tokens: 128,
    });

    console.log(`Provider: ${geminiResponse.provider}`);
    console.log(`Response: ${geminiResponse.content}\n`);

    // ─── Example 4: Token Usage Report ───────────────────────────

    console.log("\n━━━ Example 4: Token Usage Report ━━━\n");

    const tokenUsage = router.getTokenUsage();
    for (const [deploymentId, usage] of Object.entries(tokenUsage)) {
        console.log(
            `${deploymentId}: prompt=${usage.promptTokens}, ` +
            `completion=${usage.completionTokens}, total=${usage.totalTokens}`
        );
    }

    console.log("\n✨ Smart Router example completed successfully!");
}

main().catch(console.error);

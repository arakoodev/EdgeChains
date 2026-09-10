/**
 * SmartRouter Example — Multi-Provider LLM Routing
 * 
 * Demonstrates how to use SmartRouter to route requests across
 * multiple LLM providers with fallback support.
 * 
 * Usage:
 *   cd examples/smart-router
 *   npm install
 *   OPENAI_API_KEY=xxx OPENROUTER_API_KEY=yyy npx tsx src/index.ts
 */

import { SmartRouter } from "@arakoodev/edgechains.js/ai";

async function main() {
    // Initialize SmartRouter with multiple providers
    const router = new SmartRouter({
        strategy: "fallback",
        retry_count: 3,
        retry_delay: 1000,
        models: [
            {
                provider: "openai",
                model: "gpt-4o",
                weight: 2,
                fallback_models: ["gpt-3.5-turbo"],
                max_tokens: 2048,
                temperature: 0.7,
            },
            {
                provider: "openai",
                model: "gpt-3.5-turbo",
                weight: 1,
                max_tokens: 2048,
                temperature: 0.7,
            },
            {
                provider: "openrouter",
                model: "openrouter/auto",
                weight: 1,
                max_tokens: 2048,
                temperature: 0.7,
            },
        ],
    });

    console.log("🤖 SmartRouter initialized!");
    console.log("📊 Stats:", router.getStats());

    // Example 1: Simple prompt routing
    console.log("\n--- Example 1: Simple Prompt ---");
    try {
        const response = await router.route({
            prompt: "What is 2+2? Answer in one word.",
        });
        console.log(`✅ Response from ${response.provider}/${response.model}:`);
        console.log(`   "${response.content}"`);
    } catch (error: any) {
        console.error("❌ All providers failed:", error.message);
    }

    // Example 2: Multi-message conversation
    console.log("\n--- Example 2: Conversation ---");
    try {
        const response = await router.route({
            messages: [
                { role: "system", content: "You are a helpful math tutor." },
                { role: "user", content: "Explain why the sky is blue in 2 sentences." },
            ],
        });
        console.log(`✅ Response from ${response.provider}/${response.model}:`);
        console.log(`   "${response.content}"`);
    } catch (error: any) {
        console.error("❌ All providers failed:", error.message);
    }

    // Example 3: Preferred model with auto-fallback
    console.log("\n--- Example 3: Preferred Model ---");
    try {
        const response = await router.route({
            prompt: "Say 'hello' in French.",
            model: "gpt-4o", // prefer gpt-4o, but will fallback if unavailable
        });
        console.log(`✅ Response from ${response.provider}/${response.model}:`);
        console.log(`   "${response.content}"`);
    } catch (error: any) {
        console.error("❌ All providers failed:", error.message);
    }

    console.log("\n📊 Final stats:", router.getStats());
}

main().catch(console.error);

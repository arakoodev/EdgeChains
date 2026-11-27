import { SmartRouter, DeploymentConfig } from "@arakoodev/edgechains.js/ai";

async function main() {
    const deployments: DeploymentConfig[] = [
        {
            id: "openai-primary",
            provider: "openai",
            model: "gpt-4o",
            apiKey: process.env.OPENAI_API_KEY,
            tpm: 100000,
        },
        {
            id: "palm-backup",
            provider: "palm",
            model: "gemini-1.5-flash",
            apiKey: process.env.GEMINI_API_KEY,
        },
        {
            id: "cohere-backup",
            provider: "cohere",
            model: "command-r",
            apiKey: process.env.COHERE_API_KEY,
        },
    ];

    const router = new SmartRouter({
        deployments,
        routingStrategy: "least-tokens",
        maxRetries: 3,
        timeoutMs: 15000,
        callbacks: [
            (event) => {
                console.log(`[Router Event] ${event.type}: ${event.provider}:${event.model} (${event.latencyMs ?? 0}ms)`);
            },
        ],
    });

    console.log("Sending chat request through SmartRouter...");
    const response = await router.chat({
        prompt: "Explain the importance of multi-provider routing in production LLM applications in two sentences.",
    });

    console.log("\n--- Response ---");
    console.log(`Provider: ${response.provider} (${response.deploymentId})`);
    console.log(`Model: ${response.model}`);
    console.log(`Total Tokens: ${response.usage.total_tokens}`);
    console.log(`Latency: ${response.latencyMs}ms`);
    console.log(`Content:\n${response.content}`);

    console.log("\n--- Streaming Response ---");
    for await (const chunk of router.chatStream({ prompt: "Count from 1 to 5." })) {
        process.stdout.write(chunk.content);
    }
    console.log("\nDone!");
}

main().catch(console.error);

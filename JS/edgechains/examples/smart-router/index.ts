import { SmartRouter, ModelDeployment } from "../../lib/router/SmartRouter";

async function runSmartRouterDemo() {
    const deployments: ModelDeployment[] = [
        {
            id: "openai-primary",
            provider: "openai",
            endpoint: "https://api.openai.com/v1/chat/completions",
            apiKey: process.env.OPENAI_API_KEY || "demo-key",
            model: "gpt-4o-mini",
            rpmLimit: 60,
            tpmLimit: 90000,
            currentTokensUsed: 1500,
        },
        {
            id: "palm-secondary",
            provider: "palm",
            endpoint: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
            apiKey: process.env.PALM_API_KEY || "demo-key",
            model: "text-bison-001",
            rpmLimit: 60,
            tpmLimit: 90000,
            currentTokensUsed: 250,
        },
        {
            id: "cohere-tertiary",
            provider: "cohere",
            endpoint: "https://api.cohere.ai/v1/generate",
            apiKey: process.env.COHERE_API_KEY || "demo-key",
            model: "command",
            rpmLimit: 60,
            tpmLimit: 90000,
            currentTokensUsed: 800,
        },
    ];

    const router = new SmartRouter(deployments, { timeoutMs: 10000, maxRetries: 3, retryDelayMs: 250 });
    const optimal = router.selectOptimalDeployment(120);
    console.log("Selected lowest-token deployment below rate-limit:", optimal.id, optimal.provider);
}

runSmartRouterDemo().catch(console.error);

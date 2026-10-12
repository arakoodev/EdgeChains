import { SmartRouter } from "@arakoodev/edgechains.js/ai";

const router = new SmartRouter({
    strategy: "least-tokens",
    modelGroups: [
        {
            name: "chat",
            fallbacks: ["backup"],
            deployments: [
                {
                    id: "openai-primary",
                    provider: "openai",
                    model: "gpt-4o",
                    apiKey: process.env.OPENAI_API_KEY,
                    rpmLimit: 3000,
                    tpmLimit: 90_000,
                },
                {
                    id: "gemini-primary",
                    provider: "gemini",
                    model: "gemini-pro",
                    apiKey: process.env.GEMINI_API_KEY,
                    latencyMs: 400,
                },
            ],
        },
        {
            name: "backup",
            strategy: "cost",
            deployments: [
                {
                    id: "cohere-backup",
                    provider: "cohere",
                    model: "command",
                    apiKey: process.env.COHERE_API_KEY,
                },
            ],
        },
    ],
});

const response = await router.completion({
    model: "chat",
    messages: [{ role: "user", content: "Explain EdgeChains in one sentence." }],
});

console.log({
    content: response.content,
    usage: response.usage,
    provider: response.provider,
    deployment: response.deployment_id,
});

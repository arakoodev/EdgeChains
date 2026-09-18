{
    strategy: "least-tokens",
    retries: 2,
    fallbackAttempts: 8,
    modelGroups: [
        {
            name: "chat",
            fallbacks: ["backup"],
            deployments: [
                {
                    id: "openai-primary",
                    provider: "openai",
                    model: "gpt-4o",
                    apiKeyEnv: "OPENAI_API_KEY",
                    rpmLimit: 3000,
                    tpmLimit: 90000,
                    cost: { input: 0.000005, output: 0.000015 },
                },
                {
                    id: "gemini-primary",
                    provider: "gemini",
                    model: "gemini-pro",
                    apiKeyEnv: "GEMINI_API_KEY",
                    latencyMs: 400,
                    weight: 2,
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
                    apiKeyEnv: "COHERE_API_KEY",
                },
            ],
        },
    ],
}

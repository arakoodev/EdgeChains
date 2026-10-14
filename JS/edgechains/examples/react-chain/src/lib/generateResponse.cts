const { SmartRouter } = require("@arakoodev/edgechains.js/ai");

async function openAICall({ prompt, apiKey }: any) {
    try {
        // Example: route across multiple deployments with token-aware load balancing.
        // In production, api keys and models would come from environment variables
        // or a jsonnet-rendered routing config passed to createSmartRouterFromConfig.
        const router = new SmartRouter({
            deployments: [
                {
                    id: "openai-primary",
                    provider: "openai",
                    apiKey: apiKey,
                    model: "gpt-3.5-turbo",
                    tokenLimit: 100000,
                    tokenUsage: 0,
                },
            ],
            retries: 2,
            timeoutMs: 30000,
        });
        const response = await router.chat({ prompt });
        return response.content;
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

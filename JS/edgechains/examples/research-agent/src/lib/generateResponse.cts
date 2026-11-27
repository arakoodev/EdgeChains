import { SmartRouter } from "@arakoodev/edgechains.js/ai";

async function openAICall({ prompt, openAIApiKey }: { prompt: string; openAIApiKey: string }) {
    try {
        const router = new SmartRouter({
            routingStrategy: "least-tokens",
            modelList: [
                {
                    deploymentId: "openai-research-agent",
                    modelName: "gpt-3.5-turbo",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: openAIApiKey,
                },
            ],
        });
        const response = await router.chat({ prompt, max_tokens: 2000 });
        return JSON.stringify(response.content);
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

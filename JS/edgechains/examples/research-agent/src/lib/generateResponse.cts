const { SmartRouter } = require("@arakoodev/edgechains.js/ai");

async function openAICall({ prompt, openAIApiKey }: { prompt: string; openAIApiKey: string }) {
    try {
        const router = new SmartRouter({
            deployments: [{
                id: "openai-default",
                provider: "openai",
                model: "gpt-3.5-turbo",
                apiKey: openAIApiKey
            }]
        });
        const response = await router.chat({ prompt, maxTokens: 2000 });
        return JSON.stringify(response.content);
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

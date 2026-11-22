const { SmartRouter } = require("@arakoodev/edgechains.js/ai");

async function openAICall({ prompt, apiKey }: any) {
    try {
        const router = new SmartRouter({
            routingStrategy: "least-tokens",
            modelList: [
                {
                    deploymentId: "openai-react-chain",
                    modelName: "gpt-3.5-turbo",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: apiKey,
                },
            ],
        });
        return router.chat({ prompt, temperature: 0 }).then((res: any) => {
            return res.content;
        });
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

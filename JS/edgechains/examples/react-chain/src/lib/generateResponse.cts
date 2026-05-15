const { SmartRouter } = require("@arakoodev/edgechains.js/ai");

async function openAICall({ prompt, apiKey }: any) {
    try {
        const router = new SmartRouter({
            apiKey: apiKey,
            temperature: 0,
        });
        return router.chat({ prompt }).then((res: any) => {
            return res.content;
        });
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

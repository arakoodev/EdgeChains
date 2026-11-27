const { Router } = require("@arakoodev/edgechains.js/ai");

async function openAICall({ prompt, apiKey }: any) {
    try {
        const router = new Router({
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

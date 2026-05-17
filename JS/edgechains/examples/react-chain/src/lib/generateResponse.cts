const { OpenAI } = require("@arakoodev/edgechains.js/openai");

async function openAICall({ prompt, apiKey }: any) {
    try {
        const openai = new OpenAI({
            apiKey: apiKey,
            temperature: 0,
        });
        return openai.chat({ prompt }).then((res: any) => {
            return res.content;
        });
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

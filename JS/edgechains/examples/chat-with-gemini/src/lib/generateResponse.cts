const { GeminiAI } = require("@arakoodev/edgechains.js/ai");

async function geminiCall({ prompt, geminiApiKey }: any) {
    try {
        const gemini = new GeminiAI({ apiKey: geminiApiKey });
        let res = await gemini.chatText({ prompt });
        return JSON.stringify(res);
    } catch (error) {
        return error;
    }
}

module.exports = geminiCall;

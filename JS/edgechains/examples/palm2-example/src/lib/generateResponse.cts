const { PalmAI } = require("@arakoodev/edgechains.js/ai");

async function palm2Call({ prompt, apiKey }: any) {
    try {
        const palm = new PalmAI({ apiKey });
        const res = await palm.chat({ prompt });
        return JSON.stringify(res);
    } catch (error: any) {
        return JSON.stringify({ error: error.message || error });
    }
}

module.exports = palm2Call;

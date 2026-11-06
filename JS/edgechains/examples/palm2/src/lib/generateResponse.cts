const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

async function palm2Call({ prompt, context, apiKey }: { prompt: string; context?: string; apiKey: string }) {
    try {
        const palm2 = new Palm2AI({ apiKey });
        const response = await palm2.chat({ prompt, context, temperature: 0.2 });
        return response?.candidates?.[0]?.content || "";
    } catch (error) {
        return error;
    }
}

module.exports = palm2Call;

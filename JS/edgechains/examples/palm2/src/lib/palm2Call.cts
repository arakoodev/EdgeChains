const { PaLM2Client } = require("@arakoodev/edgechains.js/ai");

async function palm2Call({ prompt, palmApiKey, temperature, maxOutputTokens }: any) {
    try {
        const palm2 = new PaLM2Client({ apiKey: palmApiKey });
        const response = await palm2.generateText(prompt, {
            temperature: temperature ?? 0.7,
            maxOutputTokens: maxOutputTokens ?? 256,
            candidateCount: 1
        });
        return JSON.stringify(response.candidates[0]);
    } catch (error) {
        return error;
    }
}

module.exports = palm2Call;

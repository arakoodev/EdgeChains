const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

async function palm2Call({ prompt, palm2ApiKey }: any) {
    try {
        const palm2 = new Palm2AI({ apiKey: palm2ApiKey });
        const res = await palm2.generateText({ prompt });
        const output = res?.candidates?.[0]?.output || "";
        return JSON.stringify({ answer: output });
    } catch (error: any) {
        return JSON.stringify({ error: error?.message || String(error) });
    }
}

module.exports = palm2Call;

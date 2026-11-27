const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

async function palm2Call({ prompt, palmApiKey }: any) {
    try {
        const palm2 = new Palm2AI({ apiKey: palmApiKey });
        const res = await palm2.chat({
            prompt,
            model: "chat-bison-001",
            temperature: 0.7,
        });
        return JSON.stringify(res);
    } catch (error: any) {
        return JSON.stringify({ error: error.message });
    }
}

module.exports = palm2Call;

const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

async function palm2Call({ prompt, palm2ApiKey }: { prompt: string; palm2ApiKey: string }) {
    try {
        const client = new Palm2AI({ apiKey: palm2ApiKey });
        const responseText = await client.chat({ prompt, model: "text-bison-001" });
        return JSON.stringify({ answer: responseText });
    } catch (error: any) {
        return JSON.stringify({ error: error.message || String(error) });
    }
}

module.exports = palm2Call;

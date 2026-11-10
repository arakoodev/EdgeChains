const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

async function palm2Call({ prompt, palm2ApiKey }: any) {
    try {
        const palm2 = new Palm2AI({ apiKey: palm2ApiKey });
        const response = await palm2.chat({ prompt });
        return JSON.stringify({
            answer: response.candidates?.[0]?.output ?? "",
            raw: response,
        });
    } catch (error) {
        return error;
    }
}

module.exports = palm2Call;

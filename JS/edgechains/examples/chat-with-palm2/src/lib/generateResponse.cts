const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

async function palm2Call({ prompt, palm2ApiKey }: any) {
    try {
        const palm2 = new Palm2AI({ apiKey: palm2ApiKey });
        const res = await palm2.chat({ prompt });
        return JSON.stringify(res.candidates[0].output);
    } catch (error) {
        return error;
    }
}

module.exports = palm2Call;
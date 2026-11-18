const { Palm2 } = require("@arakoodev/edgechains.js/ai");

module.exports = async function generateResponse({ prompt, palm2ApiKey }: { prompt: string; palm2ApiKey: string }) {
    const palm2 = new Palm2({ apiKey: palm2ApiKey });
    const response = await palm2.chat({ prompt });
    return response;
};

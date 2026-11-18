const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

function generateResponse(params) {
    const { prompt, palmApiKey } = JSON.parse(params);
    const palm2 = new Palm2AI({ apiKey: palmApiKey });
    return palm2
        .chat({ prompt })
        .then((res) => {
            return res.candidates && res.candidates[0] ? res.candidates[0].content : "";
        })
        .catch((err) => {
            return err.message;
        });
}

module.exports = generateResponse;

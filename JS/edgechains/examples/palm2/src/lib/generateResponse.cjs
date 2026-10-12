const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

module.exports = async function generateResponse({ prompt, palm2ApiKey }) {
  const palm2 = new Palm2AI({ apiKey: palm2ApiKey });
  return palm2.chat({ prompt });
};

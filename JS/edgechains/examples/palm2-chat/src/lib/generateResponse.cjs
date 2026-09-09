const { Palm2AI } = require("@arakoodev/edgechains.js/ai");
async function palm2Call({ prompt, palm2ApiKey }) {
  try {
    const palm2 = new Palm2AI({ apiKey: palm2ApiKey });
    let res = await palm2.chat({ prompt });
    return JSON.stringify(res);
  } catch (error) {
    return JSON.stringify({ error: error.message });
  }
}
module.exports = palm2Call;

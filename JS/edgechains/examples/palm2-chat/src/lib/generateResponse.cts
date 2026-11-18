const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

async function palm2Call({
  prompt,
  palmApiKey,
}: {
  prompt: string;
  palmApiKey: string;
}) {
  try {
    const palm2 = new Palm2AI({ apiKey: palmApiKey });
    const response = await palm2.generateText({ prompt });
    return JSON.stringify(response);
  } catch (error) {
    return JSON.stringify({ error });
  }
}

module.exports = palm2Call;

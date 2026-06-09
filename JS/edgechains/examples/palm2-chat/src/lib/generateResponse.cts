const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

async function palm2Call({ prompt, palmApiKey }: any) {
  try {
    const palm2 = new Palm2AI({ apiKey: palmApiKey });
    const response = await palm2.generateText({
      prompt,
      temperature: 0.4,
      candidate_count: 1,
      maxOutputTokens: 256,
    });

    return JSON.stringify(response);
  } catch (error) {
    return JSON.stringify({ error });
  }
}

module.exports = palm2Call;

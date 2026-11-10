const { GeminiAI } = require("@arakoodev/edgechains.js/ai");

async function geminiCall({
  prompt,
  geminiApiKey,
  model,
  temperature,
  maxOutputTokens,
}: {
  prompt: string;
  geminiApiKey: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
}) {
  const gemini = new GeminiAI({ apiKey: geminiApiKey });
  const response = await gemini.chat({
    prompt,
    model,
    temperature,
    maxOutputTokens,
  });

  return JSON.stringify(response);
}

module.exports = geminiCall;

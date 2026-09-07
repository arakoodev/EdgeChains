const { OpenAI } = require("@arakoodev/edgechains.js/ai");

function isPlaceholder(value?: string) {
    return !value || /your-|^\*+$|\*\*\*|sk-proj-\*\*\*/i.test(value);
}

async function openAICall({ prompt, openAIApiKey }: { prompt: string; openAIApiKey?: string }) {
    try {
        if (isPlaceholder(openAIApiKey)) {
            return JSON.stringify({
                answer: "OpenAI API key is not configured. Returning the redacted prompt only.",
                redactedPrompt: prompt,
            });
        }
        const openai = new OpenAI({ apiKey: openAIApiKey });
        const res = await openai.chat({ prompt, max_tokens: 256 });
        return JSON.stringify(res);
    } catch (error: any) {
        return JSON.stringify({ error: error?.message || String(error) });
    }
}

module.exports = openAICall;

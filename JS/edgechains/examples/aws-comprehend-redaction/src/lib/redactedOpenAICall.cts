const { AwsComprehendRedactor, OpenAI } = require("@arakoodev/edgechains.js/ai");

async function redactedOpenAICall({ prompt, openAIApiKey }: { prompt: string; openAIApiKey: string }) {
    const redactor = new AwsComprehendRedactor({
        region: process.env.AWS_REGION || "us-east-1",
    });
    const openai = new OpenAI({ apiKey: openAIApiKey });
    const redactedPrompt = await redactor.redactPrompt(prompt);

    return openai.chat({
        prompt: redactedPrompt,
    });
}

module.exports = redactedOpenAICall;

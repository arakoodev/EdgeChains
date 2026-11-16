import { AwsComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

const redactor = new AwsComprehendRedactor({
    region: process.env.AWS_REGION || "us-east-1",
    confidenceThreshold: 0.9,
    redactionToken: (entity) => `[${entity.type}]`,
});

const openAI = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    orgId: process.env.OPENAI_ORG_ID,
});

const prompt = "Summarize this support note: Jane Doe can be reached at jane@example.com.";
const redactedPrompt = await redactor.redactPrompt(prompt);

console.log("Redacted prompt:", redactedPrompt);

const response = await redactor.redactAndCall(openAI, {
    prompt,
    max_tokens: 100,
});

console.log(response);

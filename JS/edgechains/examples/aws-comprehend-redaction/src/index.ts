import { AwsComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

const redactor = new AwsComprehendRedactor({
    region: process.env.AWS_REGION || "us-east-1",
    languageCode: "en",
    minScore: 0.8,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    orgId: process.env.OPENAI_ORG_ID,
});

const prompt =
    "Summarize this support note without exposing PII: Jane Smith, jane@example.com, called from +15551234567 about invoice INV-123.";

const redactedPrompt = await redactor.redactPrompt(prompt);

const completion = await openai.chat({
    model: "gpt-3.5-turbo",
    prompt: redactedPrompt,
});

console.log({
    redactedPrompt,
    completion,
});

import { OpenAI, AwsComprehendRedactor } from "@arakoodev/edgechains.js/ai";

const redactor = new AwsComprehendRedactor({
    region: process.env.AWS_REGION || "us-east-1",
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    orgId: process.env.OPENAI_ORG_ID,
});

const prompt = "Summarize this support request: My email is jane@example.com and my phone is 555-123-4567.";

const response = await redactor.chain({ prompt }, (redactedPrompt) =>
    openai.chat({
        ...redactedPrompt,
        max_tokens: 128,
    })
);

console.log(response);

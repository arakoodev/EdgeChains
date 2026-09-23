import { AwsComprehendRedactor } from "@arakoodev/edgechains.js/redaction";

const redactor = new AwsComprehendRedactor({
    clientConfig: {
        region: process.env.AWS_REGION ?? "us-east-1",
    },
});

const prompt =
    "Please summarize this support request from Jane Doe at jane@example.com about invoice 12345.";

const result = await redactor.redact(prompt);
const safeChatOptions = await redactor.redactPromptOptions({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
});

console.log(result.redactedText);
console.log(safeChatOptions);

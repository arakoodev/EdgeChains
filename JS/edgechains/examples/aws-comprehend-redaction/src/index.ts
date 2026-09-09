import { AwsComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

async function main() {
    const redactor = new AwsComprehendRedactor({
        region: process.env.AWS_REGION || "us-east-1",
    });
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        orgId: process.env.OPENAI_ORG_ID,
    });

    const safeInput = await redactor.redactChatInput({
        prompt: "Summarize this support note without exposing PII: Jane Doe uses jane@example.com.",
        model: "gpt-3.5-turbo",
    });

    const response = await openai.chat(safeInput);
    console.log(response.content);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

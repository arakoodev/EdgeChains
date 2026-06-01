import { ComprehendPiiRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

async function main() {
    const openAI = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        orgId: process.env.OPENAI_ORG_ID,
    });

    const redactor = new ComprehendPiiRedactor({
        region: process.env.AWS_REGION || "us-east-1",
    });

    const safeOpenAI = redactor.pipe(openAI);

    const response = await safeOpenAI.chat({
        prompt: "Summarize this support note: Alice called from 555-123-4567 about invoice INV-100.",
        temperature: 0.2,
    });

    console.log(response);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});

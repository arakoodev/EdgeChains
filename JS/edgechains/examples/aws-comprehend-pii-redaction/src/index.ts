import { OpenAI, ComprehendPiiRedactor } from "@arakoodev/edgechains.js/ai";

async function main() {
    const openAi = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || "demo-key",
    });

    const piiRedactor = new ComprehendPiiRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        maskMode: "TYPE_TAG",
        minScore: 0.75,
    });

    const safeOpenAi = piiRedactor.chain(openAi);

    safeOpenAi.subscribe((event) => {
        console.log("[ComprehendPiiRedactor] Redacted", event.entities.length, "PII entities:");
        console.log("  Before:", event.originalText);
        console.log("  After :", event.redactedText);
    });

    const response = await safeOpenAi.chat({
        prompt: "Summarize this support ticket: Customer Jane Doe (jane.doe@example.com, SSN 123-45-6789) requested a refund.",
    });

    console.log("LLM Response:", response);
}

main().catch(console.error);

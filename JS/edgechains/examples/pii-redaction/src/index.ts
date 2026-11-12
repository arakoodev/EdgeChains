import { OpenAI } from "@arakoodev/edgechains.js/ai";
import { AWSComprehendRedactor, RedactableEndpoint } from "@arakoodev/edgechains.js/pii-redactor";

// 1. Create the underlying AI endpoint
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// 2. Create the AWS Comprehend redactor
const redactor = new AWSComprehendRedactor({
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
});

// 3. Wrap the endpoint — PII is redacted BEFORE reaching OpenAI
const safeEndpoint = new RedactableEndpoint(openai, redactor, (result) => {
    if (result.entities.length > 0) {
        console.log(`Redacted ${result.entities.length} PII entities:`,
            result.entities.map((e) => e.Type).join(", "));
    }
});

// 4. Use it exactly like the original endpoint
async function main() {
    const response = await safeEndpoint.chat({
        prompt: "My name is John Smith, SSN 123-45-6789, email john@example.com. Can you help me?",
    });
    console.log("AI Response:", response.content);
    // The prompt sent to OpenAI was:
    // "My name is [REDACTED:NAME], SSN [REDACTED:SSN], email [REDACTED:EMAIL]. Can you help me?"
}

main().catch(console.error);

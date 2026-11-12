import { AWSComprehend } from "@arakoodev/edgechains.js/ai";
import { OpenAI } from "@arakoodev/edgechains.js/ai";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const redactor = new AWSComprehend();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // --- Single Redaction Example ---
    console.log("\n--- Single Redaction ---");
    const sensitivePrompt =
        "My name is John Doe and my email is john.doe@example.com. Can you summarize this?";

    console.log("Original Prompt:", sensitivePrompt);

    // Use chaining to redact before sending to OpenAI
    const result = await redactor.chain(sensitivePrompt, async (redacted) => {
        console.log("Redacted Prompt (sent to AI):", redacted);
        return await openai.chat({ prompt: redacted });
    });

    console.log("AI Response:", result.content);

    // --- Batch Redaction Example ---
    console.log("\n--- Batch Redaction ---");
    const sensitiveTexts = [
        "Contact me at john.doe@example.com",
        "Jane Smith's phone is 555-0101",
        "No PII here, just a normal message.",
    ];

    console.log("Original Texts:", sensitiveTexts);

    const redactedTexts = await redactor.batchRedact(sensitiveTexts);
    console.log("Redacted Batch Results:", redactedTexts);
}

main().catch(console.error);

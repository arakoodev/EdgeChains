/**
 * Example: Chaining AWSComprehendRedactor with EdgeChains OpenAI Endpoint
 *
 * Prerequisites:
 *   export AWS_REGION=us-east-1
 *   export AWS_ACCESS_KEY_ID=...
 *   export AWS_SECRET_ACCESS_KEY=...
 *   export OPENAI_API_KEY=...
 */
import { OpenAI } from "../../arakoodev/src/ai/src/index.js";
import { AWSComprehendRedactor } from "../../arakoodev/src/ai/src/lib/aws-comprehend/awsComprehendRedactor.js";

async function main() {
    const redactor = new AWSComprehendRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        minConfidence: 0.75,
        redactTypes: ["EMAIL", "PHONE", "SSN", "CREDIT_DEBIT_NUMBER"],
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const rawPrompt =
        "Draft a polite billing follow-up for Jane Doe (jane.doe@example.com, phone 555-0142) regarding account SSN 123-45-6789.";

    await redactor
        .chainWithEndpoint(rawPrompt, openai, { model: "gpt-4o-mini", temperature: 0.2 })
        .subscribe(
            ({ redaction, response }) => {
                console.log("Redacted Prompt:", redaction.redactedText);
                console.log("Entities Redacted:", redaction.redactedCount);
                console.log("LLM Response:", response);
            },
            (err) => {
                console.error("Pipeline error:", err);
            }
        );
}

main().catch(console.error);

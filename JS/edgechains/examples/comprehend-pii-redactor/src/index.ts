import { ComprehendRedactor, RedactorChain } from "@arakoodev/edgechains.js";

/**
 * Demonstrates how to use the `ComprehendRedactor` utility from
 * `@arakoodev/edgechains.js` to detect and redact PII (names, emails, phone
 * numbers, credit cards, SSNs, ...) from arbitrary text before it is sent to an
 * LLM.
 *
 * The redactor is designed to be chained in front of the existing EdgeChains
 * `Endpoint` classes (e.g. `OpenAI`) so that prompts are scrubbed of sensitive
 * information before they ever leave your process.
 *
 * Usage:
 *   1. Configure your AWS credentials (env vars, shared config, or IAM role).
 *   2. Run: `npm install && npm run start`
 */
async function main() {
    // Credentials are resolved from the standard AWS provider chain
    // (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION, shared config,
    // or an attached IAM role). Pass them explicitly if you prefer:
    //
    //   const redactor = new ComprehendRedactor({
    //       accessKeyId: "...",
    //       secretAccessKey: "...",
    //       region: "us-east-1",
    //   });
    const redactor = new ComprehendRedactor({
        region: process.env.AWS_REGION || "us-east-1",
    });

    const samples = [
        "Hi, my name is John Doe. You can reach me at john.doe@example.com or 212-555-0199.",
        "Please charge my card 4111-1111-1111-1111 and email the receipt to jane@corp.io.",
        "Patient SSN is 123-45-6789 and their phone is (415) 555-0132.",
    ];

    for (const text of samples) {
        console.log("\n=== Original ===");
        console.log(text);

        const { redactedText, entities } = await redactor.redact(text);

        console.log("\n=== Redacted ===");
        console.log(redactedText);

        console.log("\n=== Detected PII entities ===");
        for (const entity of entities) {
            console.log(
                `  - ${entity.type}: "${entity.text}" (score ${entity.score.toFixed(2)})`
            );
        }
    }

    // You can also restrict redaction to specific entity types:
    //
    //   const { redactedText } = await redactor.redact(text, {
    //       entityTypes: ["EMAIL", "PHONE"],
    //       replacement: "[HIDDEN]",
    //   });

    // ---------------------------------------------------------------------
    // Chaining with an LLM Endpoint (as an observable / middleware).
    // ---------------------------------------------------------------------
    // `RedactorChain.wrap` returns a transparent proxy around any EdgeChains
    // endpoint whose `chat()` redacts the prompt before the LLM ever sees it
    // (and, optionally, redacts the response on the way back out):
    //
    //   import { OpenAI } from "@arakoodev/edgechains.js";
    //
    //   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    //   const safe = RedactorChain.wrap(openai, redactor, { redactResponse: true });
    //
    //   const response = await safe.chat({
    //       prompt: "My SSN is 123-45-6789, summarize my profile.",
    //   });
    //   // -> OpenAI only ever receives "My SSN is [REDACTED], summarize my profile."
}

main().catch((error) => {
    console.error("Failed to redact text with AWS Comprehend:", error);
    process.exit(1);
});
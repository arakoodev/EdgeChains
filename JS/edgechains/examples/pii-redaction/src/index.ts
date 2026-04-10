/**
 * AWS Comprehend PII Redaction Example
 *
 * Demonstrates how to chain PiiRedactor with EdgeChains endpoint classes
 * to automatically redact sensitive information before sending prompts to LLMs.
 *
 * Usage:
 *   AWS_ACCESS_KEY_ID=your_key AWS_SECRET_ACCESS_KEY=your_secret npx ts-node src/index.ts
 *
 * Or with environment variables already set:
 *   npx ts-node src/index.ts
 */

import { PiiRedactor } from "@arakoodev/edgechains.js/ai";

async function main() {
    console.log("=== EdgeChains AWS Comprehend PII Redaction Example ===\n");

    // Create a PII redactor instance
    const redactor = new PiiRedactor({
        region: "us-east-1",
        // Credentials are read from env vars if not provided here:
        // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    });

    // Example 1: Simple PII detection
    console.log("--- Example 1: Detect PII ---");
    const sampleText = "My name is John Smith, my phone is 555-123-4567, and my SSN is 123-45-6789.";
    console.log("Input:", sampleText);

    const detected = await redactor.detectPiiEntities({ text: sampleText });
    console.log("PII found:", detected.hasPii);
    console.log("Entities:");
    detected.entities.forEach((entity) => {
        const segment = sampleText.slice(entity.BeginOffset, entity.EndOffset);
        console.log(`  - ${entity.Type}: "${segment}" (confidence: ${(entity.Score ?? 0).toFixed(2)})`);
    });

    // Example 2: Quick PII check
    console.log("\n--- Example 2: Quick PII Check ---");
    const cleanText = "The weather is nice today.";
    const hasPii = await redactor.containsPii({ text: cleanText });
    console.log(`"${cleanText}" contains PII: ${hasPii}`);

    // Example 3: Redact with fixed mask (default)
    console.log("\n--- Example 3: Redact with fixed mask ---");
    const fixedResult = await redactor.redact({
        text: sampleText,
        maskMode: "fixed",
        maskValue: "[REDACTED]",
    });
    console.log("Redacted:", fixedResult.redactedText);

    // Example 4: Redact with character mask
    console.log("\n--- Example 4: Redact with character mask ---");
    const charResult = await redactor.redact({
        text: sampleText,
        maskMode: "char",
        maskChar: "X",
    });
    console.log("Redacted:", charResult.redactedText);

    // Example 5: Redact with entity labels
    console.log("\n--- Example 5: Redact with entity labels ---");
    const labelResult = await redactor.redact({
        text: sampleText,
        maskMode: "label",
    });
    console.log("Redacted:", labelResult.redactedText);

    // Example 6: Filter specific entity types
    console.log("\n--- Example 6: Filter specific PII types ---");
    const filteredResult = await redactor.redact({
        text: sampleText,
        piiEntityTypes: ["SSN"], // Only redact SSNs
        maskMode: "label",
    });
    console.log("Only SSN redacted:", filteredResult.redactedText);

    // Example 7: Chain with prompt processing (pipe + chain pattern)
    console.log("\n--- Example 7: Chained pipeline ---");
    const userPrompt = "Hi, my name is Jane Doe and I live at 456 Oak Avenue. Can you help me?";

    // Pipe the prompt through redaction, then chain into a handler
    const result = await redactor
        .pipe(userPrompt, { maskMode: "label" })
        .chain(async (redacted) => {
            // In a real application, you would chain this with an endpoint:
            // const response = await openai.chat({ prompt: redacted.redactedText });
            return {
                safePrompt: redacted.redactedText,
                piiCount: redacted.entities.length,
                entityTypes: redacted.entities.map((e) => e.Type),
            };
        });

    console.log("Original prompt:", userPrompt);
    console.log("Safe prompt:    ", result.safePrompt);
    console.log("PII entities:   ", result.entityTypes.join(", "));

    // Example 8: Convenience method for quick redaction
    console.log("\n--- Example 8: Quick redactPrompt ---");
    const safePrompt = await redactor.redactPrompt(userPrompt);
    console.log("Original:", userPrompt);
    console.log("Safe:    ", safePrompt);

    console.log("\n=== Done ===");
}

main().catch(console.error);

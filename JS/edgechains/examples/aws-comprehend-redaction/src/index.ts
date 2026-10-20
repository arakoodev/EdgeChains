import { AWSComprehend } from "@arakoodev/edgechains.js/ai";

/**
 * AWS Comprehend PII Redaction Example
 *
 * This example demonstrates how to use AWSComprehend to detect and redact
 * personally identifiable information (PII) from text before sending it
 * to an LLM, protecting user privacy.
 *
 * Prerequisites:
 *   - AWS credentials configured (env vars or ~/.aws/credentials)
 *   - AWS_REGION set (defaults to us-east-1)
 */

async function main() {
    // Initialize with explicit credentials or rely on AWS env vars / IAM role
    const comprehend = new AWSComprehend({
        // accessKeyId: "your-key",
        // secretAccessKey: "your-secret",
        // region: "us-east-1",
    });

    const userPrompt =
        "My name is John Smith and my email is john.smith@example.com. " +
        "My SSN is 123-45-6789 and I live at 123 Main St, Springfield IL.";

    console.log("Original prompt:");
    console.log(userPrompt);
    console.log();

    // 1. Quick check: does the prompt contain PII?
    const hasPii = await comprehend.containsPii({ text: userPrompt });
    console.log("Contains PII:", hasPii);
    console.log();

    // 2. Detect specific PII entities
    const detected = await comprehend.detectPiiEntities({ text: userPrompt });
    console.log("Detected PII entities:");
    for (const entity of detected.entities) {
        console.log(
            `  - ${entity.Type}: offset ${entity.BeginOffset}-${entity.EndOffset} (score: ${entity.Score})`
        );
    }
    console.log();

    // 3. Redact all PII from the prompt
    const redacted = await comprehend.redact({ text: userPrompt });
    console.log("Redacted prompt:");
    console.log(redacted.redactedText);
    console.log();

    // 4. One-liner: redact and get the string directly
    const safePrompt = await comprehend.redactPrompt(userPrompt);
    console.log("Safe prompt (one-liner):");
    console.log(safePrompt);
    console.log();

    // 5. Redact only specific PII types (e.g., only SSN and EMAIL)
    const partialRedact = await comprehend.redact({
        text: userPrompt,
        piiEntityTypes: ["SSN" as any, "EMAIL" as any],
        maskCharacter: "X",
    });
    console.log("Partially redacted (SSN + EMAIL only):");
    console.log(partialRedact.redactedText);
}

main().catch(console.error);

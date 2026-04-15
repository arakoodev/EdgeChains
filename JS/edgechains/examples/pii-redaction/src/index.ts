/**
 * PII Redaction Example for EdgeChains
 *
 * Demonstrates using ComprehendPIIRedactor to strip sensitive data
 * from LLM prompts and responses before they leave your system.
 *
 * Prerequisites:
 *   - AWS credentials configured (env vars, ~/.aws/credentials, or IAM role)
 *   - npm install
 *
 * Run: npx tsx src/index.ts
 */

import { ComprehendPIIRedactor } from "@arakoodev/edgechains.js/pii-redactor";

async function main() {
    // Initialize the redactor — picks up AWS creds from environment
    const redactor = new ComprehendPIIRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        mask: "[REDACTED]",
    });

    console.log("=== EdgeChains PII Redaction Example ===\n");

    // --- Example 1: Direct redaction ---
    const userInput = "Hi, my name is Alice Johnson and my email is alice@example.com. My SSN is 123-45-6789.";
    console.log("Original input:");
    console.log(`  "${userInput}"\n`);

    const result = await redactor.redact(userInput);
    console.log("Redacted output:");
    console.log(`  "${result.redactedText}"\n`);
    console.log("Detected entities:");
    for (const entity of result.entities) {
        console.log(`  - ${entity.type}: "${entity.originalText}" (confidence: ${(entity.score * 100).toFixed(1)}%)`);
    }

    // --- Example 2: Chainable with endpoint responses ---
    // Simulate an OpenAI response
    console.log("\n--- Chaining with simulated endpoint response ---\n");

    const fakeResponse = "Sure, I can help Sarah Connor at sarah.connor@skynet.com. Her phone is 555-0199.";
    console.log("Endpoint response:");
    console.log(`  "${fakeResponse}"\n`);

    // Use pipe() to drop into a .then() chain
    const redactedResponse = await Promise.resolve(fakeResponse).then(redactor.pipe());
    console.log("Redacted response:");
    console.log(`  "${redactedResponse}"\n`);

    // --- Example 3: Redact a conversation ---
    console.log("--- Redacting conversation history ---\n");

    const messages = [
        { role: "user", content: "My credit card number is 4111-1111-1111-1111" },
        { role: "assistant", content: "I see you've shared a card number. How can I help?" },
    ];

    const redactedMessages = await redactor.redactMessages(messages);
    for (const msg of redactedMessages) {
        console.log(`  [${msg.role}]: "${msg.content}"`);
        if (msg.redaction) {
            console.log(`    ^ ${msg.redaction.entities.length} PII entity(ies) redacted`);
        }
    }

    // --- Example 4: Type-specific filtering ---
    console.log("\n--- Filtering: only redact EMAIL ---\n");

    const emailOnlyRedactor = new ComprehendPIIRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        entityTypes: ["EMAIL"],
    });

    const mixedInput = "Contact bob@corp.com at 555-1234. His SSN is 987-65-4321.";
    const filtered = await emailOnlyRedactor.redact(mixedInput);
    console.log(`  Input:     "${mixedInput}"`);
    console.log(`  Redacted:  "${filtered.redactedText}"`);
    console.log("  (Only email was redacted; phone and SSN left intact)\n");

    console.log("=== Done ===");
}

main().catch((err) => {
    console.error("Error:", err.message);
    if (err.message.includes("credentials")) {
        console.error("\nMake sure AWS credentials are configured:");
        console.error("  export AWS_ACCESS_KEY_ID=...");
        console.error("  export AWS_SECRET_ACCESS_KEY=...");
        console.error("  export AWS_REGION=us-east-1");
    }
    process.exit(1);
});

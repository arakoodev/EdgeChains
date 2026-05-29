/**
 * Example: Using PIIRedactor with EdgeChains AI Endpoints
 * 
 * This example demonstrates how to use the PIIRedactor class
 * to detect and redact PII from prompts before sending to LLMs.
 * 
 * Prerequisites:
 * - AWS account with Comprehend access
 * - Set environment variables:
 *   AWS_ACCESS_KEY_ID=your-access-key
 *   AWS_SECRET_ACCESS_KEY=your-secret-key
 *   AWS_REGION=us-east-1
 * 
 * Usage:
 *   npx ts-node examples/pii-redaction-example.ts
 */

import { PIIRedactor } from "../arakoodev/src/ai/src/lib/pii-redactor/pii-redactor";

async function main() {
    // Initialize the redactor with AWS credentials
    const redactor = new PIIRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        redactionChar: "[REDACTED]",
    });

    console.log("=== PII Redaction Example ===\n");

    // Example 1: Simple text redaction
    const text1 = "My name is John Doe and my SSN is 123-45-6789";
    console.log("Original:", text1);
    const result1 = await redactor.redact(text1);
    console.log("Redacted:", result1.redactedText);
    console.log("Entities found:", result1.count);
    console.log("Entity types:", result1.detectedEntities.map(e => e.Type).join(", "));
    console.log();

    // Example 2: Email and phone redaction
    const text2 = "Contact me at john.doe@company.com or call 555-123-4567";
    console.log("Original:", text2);
    const result2 = await redactor.redact(text2);
    console.log("Redacted:", result2.redactedText);
    console.log();

    // Example 3: Chat message redaction
    const messages = [
        { role: "user", content: "Hi, I am Jane Smith. My email is jane@test.com" },
        { role: "assistant", content: "Hello Jane, how can I help you?" },
        { role: "user", content: "My credit card is 4111-1111-1111-1111" },
    ];
    console.log("Redacting chat messages...");
    const redactedMessages = await redactor.redactMessages(messages);
    for (const msg of redactedMessages) {
        console.log(`  [${msg.role}]: ${msg.content}`);
    }
    console.log();

    // Example 4: Chain with OpenAI endpoint
    console.log("=== Chaining with OpenAI ===");
    console.log("Before redaction: Please send the report to bob@company.org");
    const redactedPrompt = await redactor.redactPrompt(
        "Please send the report to bob@company.org"
    );
    console.log("After redaction:", redactedPrompt);
    // Now you can pass redactedPrompt to OpenAI.chat({ prompt: redactedPrompt })
}

main().catch(console.error);

import { ComprehendPiiRedactor } from "@arakoodev/edgechains.js/redactor";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

/**
 * Example: PII Redaction with AWS Comprehend
 *
 * This example demonstrates how to use ComprehendPiiRedactor to detect
 * and redact personally identifiable information (PII) from text prompts
 * before sending them to an LLM.
 *
 * Prerequisites:
 *   - AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 *   - OpenAI API key (OPENAI_API_KEY)
 *
 * Setup:
 *   export AWS_ACCESS_KEY_ID=your-key
 *   export AWS_SECRET_ACCESS_KEY=your-secret
 *   export AWS_REGION=us-east-1
 *   export OPENAI_API_KEY=your-openai-key
 */

async function main() {
    // Initialize the PII redactor
    const redactor = new ComprehendPiiRedactor();

    // Example 1: Detect PII in text
    console.log("=== Example 1: Detect PII Entities ===\n");
    const sampleText =
        "Hello, my name is John Smith. You can reach me at john.smith@example.com " +
        "or call me at 555-123-4567. My SSN is 123-45-6789 and I live at " +
        "123 Main Street, New York, NY 10001.";

    try {
        const entities = await redactor.detectPiiEntities(sampleText);
        console.log("Detected PII entities:");
        entities.forEach((entity) => {
            console.log(`  - ${entity.type}: "${entity.text}" (confidence: ${(entity.score * 100).toFixed(1)}%)`);
        });
    } catch (error) {
        console.log("Note: AWS credentials required for PII detection.");
        console.log("Simulating detection for demo purposes...\n");
        // For demo, show what would be detected
        console.log("Detected PII entities (simulated):");
        console.log('  - NAME: "John Smith" (confidence: 99.2%)');
        console.log('  - EMAIL: "john.smith@example.com" (confidence: 98.7%)');
        console.log('  - PHONE: "555-123-4567" (confidence: 97.3%)');
        console.log('  - SSN: "123-45-6789" (confidence: 99.8%)');
        console.log('  - ADDRESS: "123 Main Street, New York, NY 10001" (confidence: 95.1%)');
    }

    // Example 2: Redact PII with different modes
    console.log("\n=== Example 2: Redact PII (Different Modes) ===\n");

    const text = "Contact John at john@example.com or SSN 123-45-6789";

    try {
        // Mode 1: Replace with entity type
        const result1 = await redactor.redact({
            text,
            maskMode: "REPLACE_WITH_ENTITY_TYPE",
        });
        console.log("REPLACE_WITH_ENTITY_TYPE mode:");
        console.log(`  Original:  ${result1.originalText}`);
        console.log(`  Redacted:  ${result1.redactedText}`);

        // Mode 2: Redact with generic label
        const result2 = await redactor.redact({
            text,
            maskMode: "REDACT",
        });
        console.log("\nREDACT mode:");
        console.log(`  Original:  ${result2.originalText}`);
        console.log(`  Redacted:  ${result2.redactedText}`);

        // Mode 3: Mask with character
        const result3 = await redactor.redact({
            text,
            maskMode: "MASK_WITH_CHARACTER",
            maskCharacter: "*",
        });
        console.log("\nMASK_WITH_CHARACTER mode:");
        console.log(`  Original:  ${result3.originalText}`);
        console.log(`  Redacted:  ${result3.redactedText}`);
    } catch (error) {
        console.log("Note: AWS credentials required for redaction.");
    }

    // Example 3: Chain with OpenAI endpoint (safe prompt)
    console.log("\n=== Example 3: Chain with LLM Endpoint ===\n");

    const unsafePrompt =
        "Hi, I'm Jane Doe (jane.doe@company.com). Can you help me with my " +
        "account ending in card number 4111-1111-1111-1111?";

    console.log("Original prompt (unsafe):");
    console.log(`  ${unsafePrompt}`);

    try {
        // Create a redactor function for prompts
        const redactPrompt = redactor.createPromptRedactor();
        const safePrompt = await redactPrompt(unsafePrompt);

        console.log("\nRedacted prompt (safe for LLM):");
        console.log(`  ${safePrompt}`);

        // You can also chain directly with an endpoint:
        // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        // const safeChat = redactor.chainWith(openai.chat.bind(openai));
        // const response = await safeChat({ prompt: unsafePrompt });
    } catch (error) {
        console.log("\nNote: AWS credentials required for redaction.");
        console.log("Simulated safe prompt:");
        console.log("  Hi, I'm [NAME] ([EMAIL]). Can you help me with my account ending in card number [CREDIT_DEBIT_CARD_NUMBER]?");
    }

    // Example 4: Filter specific entity types
    console.log("\n=== Example 4: Filter Specific Entity Types ===\n");

    try {
        const result = await redactor.redact({
            text: "Name: John, Email: john@test.com, Phone: 555-1234",
            entityTypes: ["NAME", "EMAIL"], // Only redact names and emails
        });
        console.log("Only redacting NAME and EMAIL:");
        console.log(`  Original:  ${result.originalText}`);
        console.log(`  Redacted:  ${result.redactedText}`);
    } catch (error) {
        console.log("Note: AWS credentials required.");
    }

    console.log("\n=== Done ===");
}

main().catch(console.error);

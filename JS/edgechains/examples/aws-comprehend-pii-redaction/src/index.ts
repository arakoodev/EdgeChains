import { PIIRedaction } from "@arakoodev/edgechains.js/ai";

function printResult(label: string, result: { originalText: string; redactedText: string; entities: any[] }) {
    console.log(`\n===== ${label} =====`);
    console.log(`Original:  ${result.originalText}`);
    console.log(`Redacted:  ${result.redactedText}`);
    console.log(`Entities found: ${result.entities.length}`);
    result.entities.forEach((e) => {
        console.log(`  - [${e.type}] at offset ${e.beginOffset}-${e.endOffset} (confidence: ${(e.score * 100).toFixed(1)}%)`);
    });
}

async function main() {
    // Example 1: Default mode - replace with PII entity type labels
    const piiRedaction = new PIIRedaction({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const text1 = "Hello, my name is Jane Doe. You can reach me at jane.doe@example.com or call 555-123-4567. My SSN is 123-45-6789.";
    const result1 = await piiRedaction.redact(text1);
    printResult("Example 1: Replace with PII entity type", result1);

    // Example 2: Character masking mode
    const maskedRedaction = new PIIRedaction({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        redactionMode: "REPLACE_WITH_CHARACTER",
        maskCharacter: "*",
    });

    const text2 = "Customer: John Smith, Account: 940517528812, Routing: 195991012, Card: 4532-1234-5678-9012.";
    const result2 = await maskedRedaction.redact(text2);
    printResult("Example 2: Character masking", result2);

    // Example 3: Filter specific entity types only
    const filteredRedaction = new PIIRedaction({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        piiEntityTypes: ["EMAIL", "PHONE"],
        confidenceThreshold: 0.7,
    });

    const text3 = "Contact: Alice (alice@company.com, 555-000-1111). Manager: Bob (bob@company.com, 555-000-2222).";
    const result3 = await filteredRedaction.redact(text3);
    printResult("Example 3: Filtered entity types (EMAIL, PHONE only)", result3);

    console.log("\n===== All examples completed successfully =====");
}

main().catch((error) => {
    console.error("Error running PII redaction examples:", error);
    process.exit(1);
});

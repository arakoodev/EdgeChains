import { Comprehend } from "@arakoodev/edgechains.js/ai";

async function main() {
    const comprehend = new Comprehend({
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
    });

    const prompt =
        "Hi, my name is John Doe. You can reach me at john.doe@example.com or 555-123-4567.";

    const entities = await comprehend.detectPii(prompt, "en");
    console.log("Detected PII entities:");
    for (const entity of entities) {
        console.log(
            `  - ${entity.type} (${entity.score.toFixed(2)}): "${entity.text}" [${entity.beginOffset}, ${entity.endOffset})`
        );
    }

    const { redactedText } = await comprehend.redactPii(prompt, "en");
    console.log("\nRedacted prompt:");
    console.log(redactedText);
}

main().catch((error) => {
    console.error("Failed to redact PII:", error);
    process.exit(1);
});

import { AWSComprehendRedactor } from "@arakoodev/ai";

async function main() {
    console.log("=== EdgeChains AWS Comprehend PII Redaction Demo ===");

    // Initialize redactor
    const redactor = new AWSComprehendRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        threshold: 0.8,
    });

    const samplePrompt =
        "Customer Jane Smith (SSN: 000-12-3456, Phone: +1-555-0199) requested a loan transfer to account 9876543210 at jane.smith@acme.corp.";

    console.log("\n[Original Prompt]:");
    console.log(samplePrompt);

    // 1. Standalone Redaction
    console.log("\n[Redacting with Tag Placeholders]:");
    const resultTags = await redactor.redact(samplePrompt, {
        maskMode: "REPLACE_WITH_TAG",
    });
    console.log(resultTags.redactedText);

    console.log("\n[Redacting with Asterisks]:");
    const resultAsterisks = await redactor.redact(samplePrompt, {
        maskMode: "REPLACE_WITH_ASTERISK",
    });
    console.log(resultAsterisks.redactedText);

    // 2. Mock Chained LLM Endpoint
    const mockOpenAIEndpoint = {
        async chat(opts: { prompt: string }) {
            return {
                content: `LLM successfully processed safe sanitized prompt: "${opts.prompt}"`,
            };
        },
    };

    console.log("\n[Chaining Redaction into LLM Endpoint]:");
    const chained = await redactor.chainWithEndpoint(
        mockOpenAIEndpoint,
        "chat",
        { prompt: samplePrompt }
    );

    console.log("LLM Response:", chained.llmResponse.content);
    console.log("Entities Scrubbed:", chained.redaction.entityCount);
}

main().catch(console.error);

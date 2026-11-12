import { AwsComprehendRedactor } from "../../arakoodev/src/ai/src/lib/comprehend/comprehendRedactor.js";

async function main() {
    console.log("=== EdgeChains AWS Comprehend PII Redactor Example ===");

    // Mock Comprehend client simulating AWS Comprehend response
    const mockClient = {
        async send(params: any) {
            const text = params.Text || "";
            const entities = [];
            const emailIdx = text.indexOf("john.doe@example.com");
            if (emailIdx !== -1) {
                entities.push({
                    Type: "EMAIL",
                    BeginOffset: emailIdx,
                    EndOffset: emailIdx + "john.doe@example.com".length,
                    Score: 0.99,
                });
            }
            const phoneIdx = text.indexOf("555-0199");
            if (phoneIdx !== -1) {
                entities.push({
                    Type: "PHONE",
                    BeginOffset: phoneIdx,
                    EndOffset: phoneIdx + "555-0199".length,
                    Score: 0.98,
                });
            }
            return { Entities: entities };
        },
    };

    const redactor = new AwsComprehendRedactor({
        region: "us-east-1",
        client: mockClient,
    });

    const userPrompt = "Hello, please contact user john.doe@example.com at phone 555-0199 for verification.";
    console.log("Original prompt:", userPrompt);

    // Chaining redaction before LLM invocation
    const sanitizedPrompt = await redactor.chain(userPrompt);
    console.log("Sanitized prompt:", sanitizedPrompt);
}

main().catch(console.error);

import {
    ComprehendRedactor,
    OpenAI,
    SimpleObservable,
} from "@arakoodev/edgechains.js/ai";

/**
 * Example demonstrating how to chain AWS Comprehend PII Redactor
 * with EdgeChains AI Endpoints (e.g., OpenAI, Gemini, or Llama).
 */
async function main() {
    console.log("=== EdgeChains AWS Comprehend PII Redactor Demo ===");

    // In production, pass the real AWS Comprehend client:
    // import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
    // const client = new ComprehendClient({ region: process.env.AWS_REGION || "us-east-1" });
    // const redactor = new ComprehendRedactor({
    //     client,
    //     commandFactory: (input) => new DetectPiiEntitiesCommand(input),
    //     minScore: 0.8,
    // });

    // For this standalone runnable demo, we simulate the Comprehend response:
    const mockComprehendClient = {
        detectPiiEntities: async ({ Text }: { Text: string }) => {
            const entities = [];
            const emailMatch = Text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch && emailMatch.index !== undefined) {
                entities.push({
                    Type: "EMAIL",
                    BeginOffset: emailMatch.index,
                    EndOffset: emailMatch.index + emailMatch[0].length,
                    Score: 0.99,
                });
            }
            const phoneMatch = Text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
            if (phoneMatch && phoneMatch.index !== undefined) {
                entities.push({
                    Type: "PHONE",
                    BeginOffset: phoneMatch.index,
                    EndOffset: phoneMatch.index + phoneMatch[0].length,
                    Score: 0.98,
                });
            }
            const ssnMatch = Text.match(/\b\d{3}-\d{2}-\d{4}\b/);
            if (ssnMatch && ssnMatch.index !== undefined) {
                entities.push({
                    Type: "SSN",
                    BeginOffset: ssnMatch.index,
                    EndOffset: ssnMatch.index + ssnMatch[0].length,
                    Score: 0.99,
                });
            }
            return { Entities: entities };
        },
    };

    const redactor = new ComprehendRedactor({
        client: mockComprehendClient,
        minScore: 0.8,
        replacement: (entity) => `[REDACTED_${entity.Type}]`,
    });

    const rawPrompt = "Hello, my SSN is 000-12-3456 and my email is user@example.com. Please assist me.";
    console.log("\n[Original Prompt]:", rawPrompt);

    // 1. Standalone redaction
    const redactedPrompt = await redactor.redact(rawPrompt);
    console.log("[Redacted Prompt]:", redactedPrompt);

    // 2. Chained Endpoint execution
    // Define an AI endpoint or use `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`
    const mockAiEndpoint = {
        chat: async (options: { prompt: string }) => {
            return {
                role: "assistant",
                content: `Successfully received sanitized prompt: "${options.prompt}"`,
            };
        },
    };

    const chainedEndpoint = redactor.chain(mockAiEndpoint);
    console.log("\nCalling chained endpoint with raw prompt containing PII...");
    const response = await chainedEndpoint.chat({ prompt: rawPrompt });
    console.log("[Endpoint Response]:", response.content);

    // 3. Reactive Observable Chaining
    console.log("\nDemonstrating Reactive Observable stream chaining...");
    const observableStream$ = redactor.chain(mockAiEndpoint).observeAndChat(
        "Urgent support for 555-234-5678, user account alert"
    );

    observableStream$.subscribe({
        next: (result) => {
            console.log("[Observable Stream Next]:", result.content);
        },
        complete: () => {
            console.log("[Observable Stream Complete]: Pipeline finished safely.");
        },
    });
}

main().catch(console.error);

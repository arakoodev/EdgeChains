import "dotenv/config";
import { firstValueFrom, of } from "rxjs";
import {
    AwsComprehendRedactor,
    AwsComprehendRedactionChain,
    redactPiiOperator,
} from "@arakoodev/edgechains.js/ai";

// Check if live AWS credentials are provided
const hasAwsCredentials = Boolean(
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
);

// If running in demo mode without AWS credentials, use mock client with realistic Comprehend response
function getComprehendClient() {
    if (hasAwsCredentials) {
        console.log("==> Mode: Live AWS Comprehend (using environment credentials)");
        return undefined; // uses default ComprehendClient
    }

    console.log("==> Mode: Mock Comprehend Client (offline demonstration)");
    return {
        send: async (command: any) => {
            const text: string = command.input.Text;
            const entities: any[] = [];

            // Detect common sample PII in demo text
            const patterns = [
                { type: "NAME", regex: /\b(Alice Johnson|Bob Smith|John Doe)\b/g },
                { type: "EMAIL", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
                { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
                { type: "PHONE", regex: /\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g },
                { type: "ADDRESS", regex: /\b\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd)\b/g },
            ];

            for (const { type, regex } of patterns) {
                let match: RegExpExecArray | null;
                while ((match = regex.exec(text)) !== null) {
                    entities.push({
                        Type: type,
                        Score: 0.98,
                        BeginOffset: match.index,
                        EndOffset: match.index + match[0].length,
                    });
                }
            }

            return { Entities: entities };
        },
    } as any;
}

async function runDemo() {
    console.log("================================================================================");
    console.log("EdgeChains: AWS Comprehend PII Redaction & Observable Chaining Demo");
    console.log("================================================================================\n");

    const samplePrompt =
        "Customer Alice Johnson (SSN: 987-65-4321, Phone: 555-867-5309, Email: alice.j@example.com) " +
        "residing at 742 Evergreen Terrace has requested account verification.";

    console.log("Original Input Prompt:");
    console.log("--------------------------------------------------------------------------------");
    console.log(samplePrompt);
    console.log("--------------------------------------------------------------------------------\n");

    // 1. Initialize Redactor
    const redactor = new AwsComprehendRedactor({
        client: getComprehendClient(),
        maskMode: "ENTITY_TYPE",
        minScore: 0.8,
    });

    // 2. Direct PII Redaction
    console.log("\n[Demo 1] Standalone PII Redaction via AwsComprehendRedactor:");
    const redactionResult = await redactor.redact(samplePrompt);
    console.log("Redacted Text:\n" + redactionResult.redactedText);
    console.log("\nDetected Entities (" + redactionResult.entitiesDetected.length + "):");
    for (const ent of redactionResult.entitiesDetected) {
        console.log(` - Type: ${ent.type.padEnd(10)} | Value: "${ent.text}" | Score: ${(ent.score * 100).toFixed(1)}%`);
    }

    // 3. RxJS Observable Operator Chaining
    console.log("\n--------------------------------------------------------------------------------");
    console.log("[Demo 2] RxJS Observable Stream with redactPiiOperator:");
    const source$ = of("Support request from Bob Smith at bob.smith@company.org regarding case #404.");
    const sanitized$ = source$.pipe(redactPiiOperator(redactor));
    const observableOutput = await firstValueFrom(sanitized$);
    console.log("Original Stream: Support request from Bob Smith at bob.smith@company.org regarding case #404.");
    console.log("Sanitized Stream Output: " + observableOutput);

    // 4. End-to-End Chaining with LLM Endpoint
    console.log("\n--------------------------------------------------------------------------------");
    console.log("[Demo 3] AwsComprehendRedactionChain Chained with LLM Endpoint:");

    // Simulated LLM Endpoint (or OpenAI instance)
    const mockEndpoint = {
        chat: async (options: { prompt?: string }) => {
            console.log(">> LLM Endpoint received prompt:\n>> \"" + options.prompt + "\"");
            return {
                role: "assistant",
                content: `Processed inquiry safely. No raw PII was exposed to external models.`,
            };
        },
    };

    const chain = new AwsComprehendRedactionChain(redactor, mockEndpoint);
    const llmResponse = await chain.chat({
        prompt: "Summarize the profile for user John Doe with email jdoe@sample.com.",
    });

    console.log("\nFinal Chain Output:");
    console.log(llmResponse);
    console.log("\n================================================================================");
    console.log("Demo completed successfully!");
    console.log("================================================================================");
}

runDemo().catch((err) => {
    console.error("Demo failed with error:", err);
    process.exit(1);
});

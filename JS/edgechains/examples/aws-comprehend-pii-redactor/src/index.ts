import { AWSComprehendRedactor } from "@arakoodev/edgechains.js/ai";
import { config } from "dotenv";

config();

async function main() {
    console.log("===============================================================================");
    console.log(" EdgeChains.js - AWS Comprehend PII Redaction & Chaining Example");
    console.log("===============================================================================\n");

    const samplePrompt =
        "Hello, my name is John Doe. My email is john.doe@cybersecurity.com, " +
        "my mobile phone number is 415-555-2671, and my SSN is 000-12-3456. " +
        "Please summarize my account status.";

    console.log("1. Original Sensitive User Prompt:");
    console.log(`   "${samplePrompt}"\n`);

    const hasAwsCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    if (!hasAwsCreds) {
        console.log("   [INFO] No AWS credentials found in environment.");
        console.log("   Running with built-in PII test harness to demonstrate full pipeline.\n");
    }

    // If AWS credentials not present, provide test fixture client
    const mockClient = hasAwsCreds
        ? undefined
        : {
              send: async () => ({
                  Entities: [
                      {
                          Type: "NAME",
                          Score: 0.98,
                          BeginOffset: samplePrompt.indexOf("John Doe"),
                          EndOffset: samplePrompt.indexOf("John Doe") + "John Doe".length,
                      },
                      {
                          Type: "EMAIL",
                          Score: 0.99,
                          BeginOffset: samplePrompt.indexOf("john.doe@cybersecurity.com"),
                          EndOffset: samplePrompt.indexOf("john.doe@cybersecurity.com") + "john.doe@cybersecurity.com".length,
                      },
                      {
                          Type: "PHONE",
                          Score: 0.97,
                          BeginOffset: samplePrompt.indexOf("415-555-2671"),
                          EndOffset: samplePrompt.indexOf("415-555-2671") + "415-555-2671".length,
                      },
                      {
                          Type: "SSN",
                          Score: 0.99,
                          BeginOffset: samplePrompt.indexOf("000-12-3456"),
                          EndOffset: samplePrompt.indexOf("000-12-3456") + "000-12-3456".length,
                      },
                  ],
              }),

          };

    // Initialize redactor with label replacement
    const redactor = new AWSComprehendRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        maskMode: "redact_label", // replaces with [EMAIL], [PHONE], [SSN], [NAME], etc.
        client: mockClient as any,
    });

    console.log("2. Running AWS Comprehend PII Detection & Redaction...");
    const result = await redactor.redact(samplePrompt);

    console.log(`\n   Detected PII Entities (${result.entityCount}):`);
    if (result.entities) {
        for (const ent of result.entities) {
            console.log(`   - Type: ${ent.Type} (Confidence: ${((ent.Score ?? 1) * 100).toFixed(1)}%)`);
        }
    }

    console.log("\n   Sanitized Redacted Prompt:");
    console.log(`   "${result.redactedText}"\n`);

    console.log("3. Demonstrating Chaining with AI Endpoint:");
    console.log("   Redactor automatically intercepts prompts in the pipeline before sending to the LLM.");

    // Simulated LLM Endpoint representing OpenAI / Gemini
    const mockLlmEndpoint = {
        async chat(options: { prompt: string }) {
            return `[LLM Engine received sanitized prompt]: "${options.prompt}"`;
        },
    };

    const securedEndpoint = redactor.chain(mockLlmEndpoint);
    const llmOutput = await securedEndpoint.chat({ prompt: samplePrompt });

    console.log(`\n   ${llmOutput}\n`);
    console.log("===============================================================================");
    console.log(" PII Redaction Pipeline Completed Successfully!");
    console.log("===============================================================================");
}

main().catch(console.error);

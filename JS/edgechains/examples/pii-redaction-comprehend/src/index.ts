import {
  AwsComprehendRedactor,
  PromptRedactionObservable,
} from "@arakoodev/edgechains.js/ai";

async function main() {
  console.log("=== EdgeChains AWS Comprehend PII Redactor Example ===\n");

  const rawPrompt =
    "Hello, my name is John Doe, my email is john.doe@example.com, and my phone number is 555-123-4567. Please charge $50 to credit card 4111-2222-3333-4444.";

  console.log("Raw Prompt:\n", rawPrompt, "\n");

  const redactor = new AwsComprehendRedactor({
    defaultMode: "REPLACE_LABEL",
    minScore: 0.8,
    fallbackLocalRules: true,
  });

  console.log("1. Inspecting PII Labels Present in Prompt:");
  const labels = await redactor.containsPiiEntities(rawPrompt);
  console.log("Detected labels:", labels);

  console.log("\n2. Redacting Text with Replacement Labels:");
  const result = await redactor.redactText(rawPrompt);
  console.log("Redacted Text:\n", result.redactedText);
  console.log("Entities identified count:", result.entities.length);

  console.log("\n3. Redacting with MASK characters [***]:");
  const maskRedactor = new AwsComprehendRedactor({
    defaultMode: "MASK",
    maskChar: "*",
    fallbackLocalRules: true,
  });
  const maskedResult = await maskRedactor.redactText(rawPrompt);
  console.log("Masked Text:\n", maskedResult.redactedText);

  console.log("\n4. Observable Pipeline Chaining:");
  const observable: PromptRedactionObservable = redactor.createObservable(rawPrompt);

  const mockLlmEndpoint = {
    async chat(messages: any[]) {
      console.log("LLM Endpoint received sanitized messages:", messages);
      return {
        reply: "Prompt processed safely without sensitive data leakage.",
      };
    },
  };

  const response = await observable.chain(mockLlmEndpoint);
  console.log("LLM Response:", response);
}

main().catch((err) => {
  console.error("Error executing example:", err);
  process.exit(1);
});

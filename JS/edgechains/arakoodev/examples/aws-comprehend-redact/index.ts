import { AWSComprehendRedact, OpenAI } from "../../src/ai/src/index";

/**
 * Example: Redact PII from user input before sending to an LLM.
 *
 * This demonstrates chaining AWS Comprehend redaction with an OpenAI
 * endpoint to protect user privacy.
 *
 * Prerequisites:
 *   export AWS_ACCESS_KEY_ID=your-access-key
 *   export AWS_SECRET_ACCESS_KEY=your-secret-key
 *   export AWS_REGION=us-east-1
 *   export OPENAI_API_KEY=your-openai-key
 */

async function main() {
  // 1. Create the redactor
  const redactor = new AWSComprehendRedact({
    region: "us-east-1",
    // accessKeyId and secretAccessKey read from env vars
  });

  // 2. Create an OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // 3. Simulate a user input containing PII
  const userInput =
    "Hi, my name is John Smith. I live at 123 Main Street, New York. " +
    "My email is john.smith@example.com and my phone is 555-123-4567. " +
    "Can you help me with my question about my SSN 123-45-6789?";

  console.log("=== Original Input ===");
  console.log(userInput);
  console.log();

  // 4. Redact PII
  const result = await redactor.redact(userInput);

  console.log("=== Redacted Text ===");
  console.log(result.redactedText);
  console.log();

  console.log("=== Detected Entities ===");
  for (const entity of result.entities) {
    console.log(
      `  [${entity.type}] "${entity.text}" (score: ${entity.score.toFixed(2)})`
    );
  }
  console.log();

  // 5. Send the redacted text to the LLM
  console.log("=== LLM Response (using redacted input) ===");
  const response = await openai.chat({
    prompt: result.redactedText,
    model: "gpt-4o",
  });
  console.log(response.content);
}

main().catch(console.error);
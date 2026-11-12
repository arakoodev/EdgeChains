import { OpenAI } from "@arakoodev/edgechains.js";
import { ComprehendRedactor } from "@arakoodev/edgechains.js";
import { from } from "rxjs";

async function main() {
  const llm = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const redactor = new ComprehendRedactor({
    region: process.env.AWS_REGION || "us-east-1",
  });

  const userPrompt = "My email is john.doe@example.com and my SSN is 123-45-6789. What services do you offer?";

  // 1. Redact PII first
  const { redacted } = await redactor.redact(userPrompt);
  console.log("Original:", userPrompt);
  console.log("Redacted:", redacted);

  // 2. Send redacted prompt to LLM
  const response = await llm.chat({ prompt: redacted });
  console.log("LLM Response:", response.content);

  // 3. Observable chaining example
  const source$ = from([
    "Contact me at jane@test.com or 555-0100",
    "My credit card is 4111-1111-1111-1111",
  ]);

  redactor.mask$(source$).subscribe({
    next: (masked) => console.log("Masked:", masked),
    complete: () => console.log("Done"),
  });
}

main().catch(console.error);

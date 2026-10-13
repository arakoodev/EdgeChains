import { AWSComprehendRedactor } from "../lib/utils/AWSComprehendRedactor";
import { of } from "rxjs";

async function main() {
  console.log("--- EdgeChains AWS Comprehend PII Redaction Demo ---");

  const redactor = new AWSComprehendRedactor({
    languageCode: "en",
    threshold: 0.8,
  });

  const promptStream$ = of(
    "Customer email: contact@domain.com, phone: 555-012-3456."
  );

  promptStream$.pipe(redactor.redactOperator()).subscribe({
    next: (output: string) => {
      console.log("\nFinal Redacted Output for LLM:");
      console.log(output);
    },
    error: (err: Error) => {
      if (err.message.includes("credentials")) {
        console.log("\nNote: AWS credentials not configured locally.");
        console.log("To run with live API calls, set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.");
        console.log("\nSimulated output:");
        console.log("Customer email: [REDACTED_EMAIL], phone: [REDACTED_PHONE].");
      } else {
        console.error(err);
      }
    },
  });
}

main().catch(console.error);
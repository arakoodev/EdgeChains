import { ComprehendPIIRedactor } from "@arakoodev/edgechains.js/ai";

async function main() {
  const redactor = new ComprehendPIIRedactor({
    region: "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  });

  // Chain: redact PII, then uppercase, then log
  redactor.pipe((t) => t.toUpperCase()).subscribe((v) =>
    console.log("Redacted:", v)
  );

  const input =
    "Contact John Doe at john.doe@example.com or call 555-123-4567. SSN: 123-45-6789.";
  const output = await redactor.redact(input);
  console.log("Input: ", input);
  console.log("Output:", output);
}

main().catch(console.error);

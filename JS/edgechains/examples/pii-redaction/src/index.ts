import { ComprehendPiiRedactor } from "@arakoodev/edgechains.js/comprehend";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

const redactor = new ComprehendPiiRedactor({
  region: process.env.AWS_REGION ?? "us-east-1",
  entityTypes: ["NAME", "EMAIL", "PHONE", "SSN"],
  replacementToken: "[REDACTED:{TYPE}]",
});

redactor.subscribe(({ entities }) => {
  console.log(`Redacted ${entities.length} PII entity(s).`);
});

const safeOpenAI = redactor.chain(
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
);

const response = await safeOpenAI.chat({
  prompt: "Summarize this support request from Jane Doe at jane@example.com.",
});

console.log(response);

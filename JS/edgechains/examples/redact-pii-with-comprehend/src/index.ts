import { AwsComprehend, OpenAI } from "@arakoodev/edgechains.js/ai";

/**
 * Example: redact PII from a prompt with Amazon Comprehend before it is
 * sent to an LLM endpoint.
 *
 * Required environment variables:
 *   AWS_REGION            e.g. "us-east-1"
 *   AWS_ACCESS_KEY_ID     AWS credentials with comprehend:DetectPiiEntities
 *   AWS_SECRET_ACCESS_KEY
 *   OPENAI_API_KEY        used for the chat call after redaction
 *
 * Run with: npm start
 */
async function main() {
  const comprehend = new AwsComprehend({
    region: process.env.AWS_REGION || "us-east-1",
  });

  const prompt =
    "Hi, I am John Doe. Please email the invoice to john@example.com " +
    "and charge my card 4111 1111 1111 1111 if the order ships late.";

  // 1. See what Comprehend detects and how the prompt looks redacted.
  const { redactedText, entities } = await comprehend.redactPii(prompt);
  console.log("Original prompt: ", prompt);
  console.log(
    "Detected PII:    ",
    entities.map((e) => `${e.Type} (${e.Score?.toFixed(2)})`).join(", "),
  );
  console.log("Redacted prompt: ", redactedText);

  // 2. Chain the redactor with an existing Endpoint class: the endpoint
  //    only ever receives the redacted prompt.
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const redactedOpenAI = comprehend.chain(openai);

  const response = await redactedOpenAI.chat({ prompt });
  console.log("Model response:  ", response.content);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

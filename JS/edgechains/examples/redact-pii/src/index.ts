import { Comprehend, OpenAI } from "@arakoodev/edgechains.js/ai";

// AWS credentials are read from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION
// (or pass them explicitly to the constructor).
const comprehend = new Comprehend({ region: process.env.AWS_REGION || "us-east-1" });

const prompt =
    "Hi, my name is John Doe, my email is john.doe@example.com and my SSN is 123-45-6789.";

async function main() {
    // 1. Redact PII directly. Each detected entity becomes its type tag, e.g. [EMAIL].
    const redacted = await comprehend.redact({ text: prompt });
    console.log("Original :", prompt);
    console.log("Redacted :", redacted);

    // You can also mask with a character instead of the type tag.
    const masked = await comprehend.redact({ text: prompt, maskCharacter: "*" });
    console.log("Masked   :", masked);

    // 2. Chain the redactor in front of an Endpoint class. The OpenAI endpoint
    //    only ever observes the redacted prompt, so PII never leaves the app.
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await comprehend.pipe(openai).chat({ prompt });
    console.log("LLM reply:", response);
}

main().catch((error) => console.error(error));

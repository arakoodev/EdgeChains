import { ComprehendRedactor } from "@arakoodev/edgechains.js/redact";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

// Credentials are read from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (and AWS_SESSION_TOKEN if set).
const redactor = new ComprehendRedactor({ region: process.env.AWS_REGION || "us-east-1" });

const prompt =
    process.argv[2] ||
    "Write a reply to John Smith (john.smith@example.com, phone 555-123-4567) about his invoice.";

const { redacted, entities } = await redactor.redact(prompt);
console.log("Original:", prompt);
console.log("Redacted:", redacted);
console.log("Entities:", entities.map((e) => e.type).join(", "));

// Optionally chain the redacted prompt into an LLM endpoint.
if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await openai.chat({ prompt: redacted });
    console.log("LLM:", res.content);
}

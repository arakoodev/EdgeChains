import { ComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

const PROMPT =
    "Hi, my name is John Doe. My email is john.doe@example.com, phone 555-123-4567, " +
    "SSN 123-45-6789 and card 4111 1111 1111 1111. Please update my account.";

/**
 * Offline stand-in for AWS DetectPiiEntities so the demo runs without credentials.
 * Live mode uses native SigV4 calls when AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are set.
 */
async function offlineDetectPii(text: string) {
    const patterns: [string, RegExp][] = [
        ["NAME", /\bJohn Doe\b/g],
        ["EMAIL", /[\w.+-]+@[\w-]+\.[\w.-]+/g],
        ["PHONE", /\b\d{3}-\d{3}-\d{4}\b/g],
        ["SSN", /\b\d{3}-\d{2}-\d{4}\b/g],
        ["CREDIT_DEBIT_NUMBER", /\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/g],
    ];
    const Entities = [];
    for (const [Type, re] of patterns) {
        for (const match of text.matchAll(re)) {
            Entities.push({
                Score: 0.99,
                Type,
                BeginOffset: match.index!,
                EndOffset: match.index! + match[0].length,
            });
        }
    }
    return { Entities };
}

const useLiveAWS = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
const redactor = new ComprehendRedactor(useLiveAWS ? {} : { mockCaller: offlineDetectPii });
console.log(`Mode: ${useLiveAWS ? "live AWS Comprehend (SigV4)" : "offline mock (set AWS keys to go live)"}\n`);

console.log("Original prompt:\n ", PROMPT, "\n");
console.log("Fully masked:\n ", await redactor.redact(PROMPT), "\n");
console.log("Label mode:\n ", await redactor.redact(PROMPT, { mode: "replace_label" }), "\n");
console.log("Only SSN + card redacted:\n ", await redactor.redact(PROMPT, {
    piiEntityTypes: ["SSN", "CREDIT_DEBIT_NUMBER"],
}), "\n");

// Chaining: the LLM endpoint only ever receives the sanitized prompt.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "sk-demo" });
const redactedChat = redactor.chain(
    async (prompt: string) => {
        console.log("Prompt received by LLM endpoint:\n ", prompt);
        if (!process.env.OPENAI_API_KEY) return { content: "(demo endpoint, set OPENAI_API_KEY for a live reply)" };
        return openai.chat({ prompt });
    },
    { piiEntityTypes: ["EMAIL", "SSN", "CREDIT_DEBIT_NUMBER"] }
);
console.log("\nChained endpoint reply:", await redactedChat(PROMPT));

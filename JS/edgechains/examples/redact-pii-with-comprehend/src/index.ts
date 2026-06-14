import { Comprehend } from "@arakoodev/edgechains.js/comprehend";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

/**
 * Redact PII with Amazon Comprehend before chaining the prompt into an LLM.
 *
 * Env vars required:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION   (Comprehend)
 *   OPENAI_API_KEY                                         (OpenAI endpoint)
 */
async function main() {
    const comprehend = new Comprehend();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const userPrompt =
        "My name is Jane Doe, my email is jane.doe@example.com and my phone is 555-0142. " +
        "Please draft a short note asking support to reset my password.";

    // 1. Strip sensitive data out of the prompt.
    const safePrompt = await comprehend.redact(userPrompt);
    console.log("Original :", userPrompt);
    console.log("Redacted :", safePrompt);

    // 2. Chain the redacted prompt straight into the OpenAI endpoint.
    const answer = await openai.chat({ prompt: safePrompt });
    console.log("LLM reply:", answer);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

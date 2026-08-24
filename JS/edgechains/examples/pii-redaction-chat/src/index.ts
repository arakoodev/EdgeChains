import { ComprehendRedactor, OpenAI, withPIIRedaction } from "@arakoodev/edgechains.js/ai";

/**
 * Example: PII-redacted LLM chat.
 *
 * Every prompt is sanitized with Amazon Comprehend BEFORE it reaches the
 * model, so names, emails, phone numbers, addresses, etc. never leave your
 * infrastructure.
 *
 * Required environment variables:
 *   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY  (Comprehend)
 *   OPENAI_API_KEY                                        (LLM)
 */
async function main() {
    const redactor = new ComprehendRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        languageCode: "en",
        // switch to "asterisk" to keep the original text length instead of [TYPE] tags
        maskStyle: "placeholder",
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Chain the redactor in front of the endpoint class.
    // From here on, every chat() prompt is automatically redacted.
    const safeOpenAI = withPIIRedaction(openai, redactor);

    const rawPrompt =
        "Hi, my name is Jane Doe, email jane.doe@corp.org. Summarize our refund policy in one sentence.";

    console.log("Original prompt:\n", rawPrompt);

    const { redactedText, entities } = await redactor.redact(rawPrompt);
    console.log("\nDetected entities:", entities);
    console.log("Prompt sent to the model:\n", redactedText);

    const response = await safeOpenAI.chat({
        prompt: rawPrompt,
        model: "gpt-3.5-turbo",
        max_tokens: 128,
    });

    console.log("\nModel reply:\n", response.content);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

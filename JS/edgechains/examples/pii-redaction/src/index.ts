import { ComprehendPiiRedactor } from "@arakoodev/edgechains.js/comprehend";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

const prompt =
    "Hi, I'm Jane Doe living at 42 Wall Street, Seattle. My email is jane.doe@example.com " +
    "and my phone is +1 555 234 1723. Can you summarize my last order #84921?";

async function main() {
    // Credentials are read from the standard AWS environment variables:
    //   AWS_REGION (or AWS_DEFAULT_REGION), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
    // or any other credential in the default AWS chain (shared config, SSO, IAM role, ...).
    const redactor = new ComprehendPiiRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        languageCode: "en",
        // only redact the PII types we care about; remove to redact every detected type
        entityTypes: ["NAME", "ADDRESS", "EMAIL", "PHONE"],
    });

    // 1) standalone redaction of a prompt
    const { redactedText, entities } = await redactor.redact(prompt);
    console.log("Detected PII:", entities.map((entity) => `${entity.Type}(${entity.Score?.toFixed(2)})`).join(", "));
    console.log("Redacted prompt:", redactedText);

    // 2) chain the redactor (as an observable) in front of an existing Endpoint class:
    //    every chat() call redacts the prompt before it reaches the LLM.
    redactor.subscribe((result) => console.log(`[observer] redacted ${result.entities.length} PII entities`));
    const safeOpenAI = redactor.chain(new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" }));

    const response = await safeOpenAI.chat({
        prompt, // the raw prompt; the chain redacts it before calling OpenAI
        model: "gpt-3.5-turbo",
        max_tokens: 256,
    });
    console.log("LLM response:", response.content);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

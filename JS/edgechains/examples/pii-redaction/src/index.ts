import { ComprehendRedactor, PiiRedactEndpoint, OpenAI } from "@arakoodev/edgechains.js/ai";

const transcript =
    "Customer Mr. John Smith reported a login problem. Reach him at john.smith@example.com " +
    "or 555-123-4567, SSN 123-45-6789, card 4111 1111 1111 1111, billing address 42 Baker Street.";

async function main() {
    // 1. Offline redaction (no AWS credentials required) with custom masks.
    const redactor = new ComprehendRedactor({
        mode: "offline",
        masks: { EMAIL: "[REDACTED_EMAIL]", SSN: "[REDACTED_SSN]" },
    });
    const result = await redactor.redact(transcript);
    console.log("--- original ---\n" + transcript + "\n");
    console.log("--- redacted ---\n" + result.redactedText + "\n");
    console.log(
        "detected entities:",
        result.entities.map((e) => `${e.Type}@${e.BeginOffset}-${e.EndOffset}`).join(", ") + "\n"
    );

    // 2. Chain redaction with an LLM endpoint so raw PII is never dispatched.
    //    The mock stands in for any EdgeChains endpoint class (OpenAI, GeminiAI, LlamaAI...).
    const fakeLlmDispatch = async (redactedPrompt: string) =>
        "[llm answered] " + redactedPrompt.slice(0, 60) + "...";
    const endpoint = new PiiRedactEndpoint(redactor, fakeLlmDispatch);
    endpoint.subscribe((event) => {
        console.log(
            `observed ${event.entities.length} PII entity(ies), dispatched prompt is free of them`
        );
    });
    console.log("\n--- chained endpoint ---");
    console.log((await endpoint.chat({ prompt: transcript })) + "\n");

    // 3. Live AWS Comprehend mode (skipped unless credentials are configured).
    if (
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_REGION
    ) {
        const aws = new ComprehendRedactor(); // mode "aws" is auto-selected from credentials
        console.log("--- aws comprehend ---");
        console.log("containsPii:", await aws.containsPii(transcript));
        console.log((await aws.redact(transcript)).redactedText);
    } else {
        console.log(
            "(aws mode skipped: set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION to enable)"
        );
    }

    // 4. Redact before an actual OpenAI call (skipped unless OPENAI_API_KEY is set).
    if (process.env.OPENAI_API_KEY) {
        const openaiChained = new PiiRedactEndpoint(
            redactor,
            new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        );
        console.log("\n--- openai via redacting endpoint ---");
        console.log((await openaiChained.chat({ prompt: transcript })).content);
    } else {
        console.log("(openai skipped: set OPENAI_API_KEY to enable)");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

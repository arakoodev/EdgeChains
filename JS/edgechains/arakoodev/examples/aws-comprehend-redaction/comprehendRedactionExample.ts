import {
    AwsComprehendRedactor,
    type ChatLikeEndpoint,
} from "../../src/ai/src/lib/comprehend/AwsComprehendRedactor.js";

/**
 * Example demonstrating how `AwsComprehendRedactor` chains with an EdgeChains
 * LLM Endpoint (`OpenAI`, `GeminiAI`, `Palm2Endpoint`, etc.) as an Observable
 * to redact sensitive PII before sending prompts to the model.
 */
export async function runAwsComprehendRedactionExample(
    endpoint: ChatLikeEndpoint<{ prompt: string }, any>,
    rawPrompt = "Hi, my name is Alice Johnson, my email is alice.johnson@example.com, and my SSN is 123-45-6789."
) {
    const redactor = new AwsComprehendRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        maskMode: "ENTITY_TYPE",
        fallbackToRegex: true,
    });

    // Chain PII redaction with the LLM endpoint via Observable pipeline
    const { redactedOptions, response } = await redactor
        .chainWithEndpoint(endpoint, { prompt: rawPrompt })
        .toPromise();

    return {
        originalPrompt: rawPrompt,
        redactedPrompt: redactedOptions.prompt,
        llmResponse: response,
    };
}

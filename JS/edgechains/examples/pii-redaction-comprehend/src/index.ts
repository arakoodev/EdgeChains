import { AWSComprehend, OpenAI, PiiObservable } from "@arakoodev/edgechains.js/ai";

async function runPiiRedactionDemo() {
    const comprehend = new AWSComprehend({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "DEMO_ACCESS_KEY",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "DEMO_SECRET_KEY",
        region: process.env.AWS_REGION || "us-east-1",
        maskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
        minConfidence: 0.7,
    });

    const openAI = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || "DEMO_OPENAI_KEY",
        orgId: process.env.OPENAI_ORG_ID || "DEMO_ORG_ID",
    });

    const rawTranscript =
        "Caller: Hi, my name is Alice Johnson, my SSN is 123-45-6789, and my email is alice.johnson@example.com. Please update my billing phone to 415-555-0192.";

    console.log("1. Chaining prompt stream through AWSComprehend Observable:");

    const chainedStream = PiiObservable.of({
        prompt: rawTranscript,
        model: "gpt-3.5-turbo" as const,
    }).flatMap((input) => comprehend.chainWithEndpoint(openAI, input));

    chainedStream.subscribe({
        next: (result) => {
            console.log("Original Prompt:", result.originalInput.prompt);
            console.log("Redacted Prompt:", result.redactedInput.prompt);
            console.log("Detected PII Entities:", result.entities);
            console.log("LLM Endpoint Response:", result.response);
        },
        error: (err) => {
            console.error("Pipeline error:", err.message || err);
        },
        complete: () => {
            console.log("Observable PII redaction chain completed.");
        },
    });
}

runPiiRedactionDemo();

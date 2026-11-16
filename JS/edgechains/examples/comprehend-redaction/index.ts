import { OpenAI } from "@arakoodev/edgechains.js/ai";
import { ComprehendRedactor } from "@arakoodev/edgechains.js/ai";

async function runRedactionChainExample() {
    const openAi = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const redactor = new ComprehendRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        maskMode: "TAG",
        minConfidence: 0.75,
    });

    const rawCustomerPrompt =
        "Hi support, my name is John Doe, my phone is +1-202-555-0143 and my email is john.doe@acme.com. Can you help me reset my billing address?";

    // Chain AWS Comprehend PII Redaction as an Observable directly into the OpenAI Endpoint
    redactor
        .chainWithEndpoint(openAi, {
            prompt: rawCustomerPrompt,
            model: "gpt-3.5-turbo",
        })
        .subscribe({
            next: ({ redaction, llmResponse }) => {
                console.log("Original Prompt:", redaction.originalText);
                console.log("Redacted Prompt sent to LLM:", redaction.redactedText);
                console.log("LLM Response:", llmResponse);
            },
            error: (err) => {
                console.error("Error in PII Redaction Chain:", err);
            },
        });
}

runRedactionChainExample();

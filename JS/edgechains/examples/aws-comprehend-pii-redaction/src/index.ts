import {
    AWSComprehend,
    OpenAI,
    RedactionObservable,
} from "../../../arakoodev/src/ai/src/index.js";

async function runExample() {
    // 1. Configure the AWS Comprehend PII redactor
    const comprehend = new AWSComprehend({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        redactionMode: "ENTITY_TYPE",
    });

    // 2. Configure the EdgeChains OpenAI Endpoint
    const openAiEndpoint = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || "demo-key",
    });

    // 3. Chain AWSComprehend with the OpenAI Endpoint (Observable pipeline)
    const safeOpenAi = comprehend.chainWithEndpoint(openAiEndpoint);

    const rawPrompt =
        "Customer John Smith (email: john.smith@acme.com, phone: 415-555-0199) asked for a billing refund.";

    // Option A: Compose via RedactionObservable.pipe(...)
    const redactedPrompt = await RedactionObservable.of(rawPrompt)
        .pipe(comprehend.asOperator())
        .toPromise();

    console.log("Redacted Prompt:", redactedPrompt);

    // Option B: Execute full chained LLM request once credentials are set
    if (process.env.OPENAI_API_KEY && process.env.AWS_ACCESS_KEY_ID) {
        const response = await safeOpenAi.chat({
            prompt: rawPrompt,
        });
        console.log("LLM Response:", response);
    }
}

runExample().catch(console.error);

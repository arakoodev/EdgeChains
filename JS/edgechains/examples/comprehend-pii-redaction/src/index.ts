import {
    ComprehendPiiRedactor,
    RedactEndpoint,
    PiiRedactionMode,
} from "../../arakoodev/src/ai/src/lib/comprehend/comprehendPiiRedactor.js";
import { OpenAI } from "../../arakoodev/src/ai/src/lib/openai/openai.js";

async function runComprehendRedactionDemo() {
    const redactor = new ComprehendPiiRedactor({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "demo-key",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "demo-secret",
        mode: PiiRedactionMode.ENTITY_TAG,
        minScore: 0.6,
    });

    const openAi = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || "demo-openai-key",
    });

    const redactEndpoint = new RedactEndpoint(redactor, openAi);

    redactEndpoint
        .chainChat$({
            prompt: "Customer Jane Doe (jane.doe@example.com, SSN 123-45-6789) requested a refund.",
        })
        .subscribe({
            next: (response) => {
                console.log("Sanitized LLM Response:", response);
            },
            error: (err) => {
                console.error("Pipeline error:", err);
            },
        });
}

runComprehendRedactionDemo();

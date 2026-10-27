import { AwsComprehend, OpenAI } from "@arakoodev/edgechains.js/ai";

async function runExample() {
    const comprehend = new AwsComprehend({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || "us-east-1",
    });

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const rawPrompt =
        "Customer Jane Doe (jane.doe@example.com, SSN 123-45-6789) requested a billing summary.";

    const pipeline$ = comprehend.chainWithEndpoint(rawPrompt, async (redactedPrompt) => {
        console.log("Redacted prompt:", redactedPrompt);
        return await openai.chat({ prompt: redactedPrompt });
    });

    pipeline$.subscribe({
        next: (response) => console.log("AI response:", response),
        error: (err) => console.error("Pipeline error:", err),
    });
}

runExample();

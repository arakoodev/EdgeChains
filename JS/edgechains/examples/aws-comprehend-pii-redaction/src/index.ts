import { AWSComprehend, OpenAI, RedactionObservable } from "@arakoodev/edgechains.js/ai";

async function main() {
    const comprehend = new AWSComprehend({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        maskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
    });

    const openAI = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || "",
        orgId: process.env.OPENAI_ORG_ID || "",
    });

    // 1. Chain AWSComprehend directly with an EdgeChains Endpoint (OpenAI)
    const safeOpenAI = comprehend.chainWithEndpoint(openAI);

    const rawPrompt =
        "Please summarize the support ticket for Jane Doe (email: jane.doe@example.com, SSN: 123-45-6789).";

    // 2. Or compose as an Observable pipeline before invoking the LLM endpoint
    RedactionObservable.of({ prompt: rawPrompt })
        .pipe(comprehend.asOperator())
        .subscribe({
            next: async (redactedOptions) => {
                console.log("Redacted Prompt:", redactedOptions.prompt);
                if (process.env.OPENAI_API_KEY) {
                    const response = await safeOpenAI.chat(redactedOptions);
                    console.log("LLM Response:", response);
                }
            },
            error: (err) => {
                console.error("Redaction pipeline error:", err);
            },
        });
}

main().catch(console.error);

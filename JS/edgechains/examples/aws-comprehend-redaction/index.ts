import "dotenv/config";
import { of } from "rxjs";
import { AwsComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

async function main(): Promise<void> {
    const redactor = new AwsComprehendRedactor({
        region: process.env.AWS_REGION ?? "us-east-1",
        minScore: 0.75,
    });

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        orgId: process.env.OPENAI_ORG_ID,
    });

    const prompt$ = of(
        "Customer John Smith (john.smith@example.com, SSN 123-45-6789) requested a billing summary."
    );

    redactor
        .chainWithEndpoint(prompt$, (redactedPrompt) =>
            openai.chat({
                model: "gpt-4o-mini",
                prompt: redactedPrompt,
                temperature: 0.2,
            })
        )
        .subscribe({
            next: (response) => {
                console.log("Redacted LLM response:", response.content);
            },
            error: (err: unknown) => {
                console.error("Redaction pipeline failed:", err);
                process.exitCode = 1;
            },
        });
}

void main();

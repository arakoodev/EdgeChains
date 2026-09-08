import { AWSComprehend, pipe } from "@arakoodev/edgechains.js/ai";
import { createDemoComprehendClient } from "./lib/demoComprehendClient.js";

/**
 * Conversation sample from the Amazon Comprehend transcript-redaction blog.
 * @see https://aws.amazon.com/blogs/machine-learning/how-to-redact-pii-data-in-conversation-transcripts/
 */
const BLOG_TRANSCRIPT = [
    {
        speaker: "Agent",
        text: "Hi, thank you for calling us today. Whom do I have the pleasure of speaking with today?",
    },
    { speaker: "Caller", text: "Hello, my name is John Stiles." },
    { speaker: "Agent", text: "Hi John, how may I help you?" },
    {
        speaker: "Caller",
        text: "I haven't received my W2 statement yet and wanted to check on its status.",
    },
    {
        speaker: "Agent",
        text: "Sure, I can help you with that. Can you please confirm the last four digits of your Social Security number?",
    },
    { speaker: "Caller", text: "Yes, it's 548-95-6370." },
    {
        speaker: "Agent",
        text: "The number we have on file for you is 555-456-7890. Is that still correct?",
    },
    { speaker: "Caller", text: "Yes, it is." },
    {
        speaker: "Agent",
        text: "Great. I have turned on automated notifications. Is there anything else I can assist you with John?",
    },
];

class FakeOpenAI {
    async chat(options: { prompt?: string }) {
        return {
            content: `Safe prompt received: ${options.prompt}`,
        };
    }
}

function printSection(title: string) {
    console.log(`\n=== ${title} ===`);
}

async function main() {
    const prompt =
        "Hi, I am Alice Johnson. Email me at alice@example.com. My SSN is 078-05-1120 and phone is 415-555-0199.";

    const comprehend = new AWSComprehend({
        client: createDemoComprehendClient(),
        maskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
    });
    const openai = new FakeOpenAI();

    printSection("1. ContainsPiiEntities preflight");
    const preflight = await comprehend.containsPii(prompt);
    console.log(JSON.stringify(preflight, null, 2));

    printSection("2. DetectPiiEntities offsets");
    const detection = await comprehend.detectPiiEntities(prompt);
    console.log(JSON.stringify(detection, null, 2));

    printSection("3. Two-pass redact() — REPLACE_WITH_PII_ENTITY_TYPE");
    const redacted = await comprehend.redact(prompt);
    console.log("original:", redacted.text);
    console.log("redacted:", redacted.redactedText);
    console.log("labels:", redacted.labels.map((label) => label.Name).join(", "));

    printSection("4. MASK mode (length-preserving)");
    const masked = await comprehend.redactPrompt({ text: prompt, maskMode: "MASK" });
    console.log(masked);

    printSection("5. chain() existing OpenAI-style endpoint");
    const chainedResponse = await comprehend.chain(openai).chat({ prompt });
    console.log(chainedResponse);

    printSection("6. pipe() Promise composition");
    const pipedResponse = await pipe(prompt, comprehend.asOperator(), (safePrompt) =>
        openai.chat({ prompt: safePrompt })
    );
    console.log(pipedResponse);

    printSection("7. Conversation transcript (AWS blog sample)");
    const transcript = await comprehend.redactTranscript(BLOG_TRANSCRIPT);
    for (const turn of transcript.turns) {
        console.log(`${turn.speaker}: ${turn.text}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

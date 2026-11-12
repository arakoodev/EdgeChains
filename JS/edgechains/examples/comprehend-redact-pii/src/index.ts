import "dotenv/config";
import { ComprehendRedactor, RedactionMode } from "@arakoodev/edgechains.js/redact";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

const transcript = `Customer: Hi, I'm Aarav Sharma, my email is aarav.sharma@example.com and my phone is +91 98765 43210. My card ending 4242 was charged twice on 12 March 2026. I live at 221B Residency Road, Bengaluru 560025.`;

async function main() {
    const redactor = new ComprehendRedactor({ mode: RedactionMode.TYPE_LABEL });

    // 1. Detect PII entities
    const entities = await redactor.detectEntities(transcript);
    console.log("Detected entities:");
    for (const e of entities) {
        console.log(`  ${e.type} (${e.score.toFixed(2)}) @ ${e.beginOffset}-${e.endOffset}`);
    }

    // 2. Redact the text
    const { redactedText } = await redactor.redact(transcript);
    console.log("\nRedacted transcript:\n" + redactedText);

    // 3. Chain with the OpenAI endpoint: the prompt is redacted before it is sent
    const prompt = `Summarize this support request in one sentence: ${transcript}`;
    if (process.env.OPENAI_API_KEY) {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            orgId: process.env.OPENAI_ORG_ID,
        });
        const chained = redactor.chain(openai);
        const response = (await chained.chat({
            prompt,
            model: "gpt-3.5-turbo",
            role: "user",
        })) as { content: string };
        console.log("\nLLM response (PII never reached OpenAI):\n" + response.content);
    } else {
        console.log("\nRedacted prompt that would be sent to the LLM:\n" + (await redactor.redactText(prompt)));
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

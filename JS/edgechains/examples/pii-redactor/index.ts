import { AWSComprehend } from "@arakoodev/edgechains.js/ai";
import { OpenAI } from "@arakoodev/edgechains.js/ai";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const redactor = new AWSComprehend();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const sensitivePrompt = "My name is John Doe and my email is john.doe@example.com. Can you summarize this?";

    console.log("Original Prompt:", sensitivePrompt);

    // Use chaining to redact before sending to OpenAI
    const result = await redactor.chain(sensitivePrompt, async (redacted) => {
        console.log("Redacted Prompt (sent to AI):", redacted);
        return await openai.chat({ prompt: redacted });
    });

    console.log("AI Response:", result.content);
}

main().catch(console.error);

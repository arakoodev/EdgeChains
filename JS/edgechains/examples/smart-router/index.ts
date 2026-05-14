import { OpenAI, GeminiAI, SmartRouter } from "@arakoodev/edgechains.js/ai";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    // 1. Initialize providers
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const gemini = new GeminiAI({ apiKey: process.env.GEMINI_API_KEY });

    // 2. Configure the Smart Router with failover
    // If OpenAI fails (e.g., rate limit, wrong key), it will try Gemini.
    const router = new SmartRouter([
        {
            instance: openai,
            label: "OpenAI (Primary)",
            model: "gpt-3.5-turbo",
        },
        {
            instance: gemini,
            label: "Gemini (Backup)",
            model: "gemini-1.5-pro",
        },
    ]);

    console.log("Sending request through Smart Router...");

    try {
        const response = await router.chat({
            prompt: "Explain the benefits of a smart router in LLM applications.",
            temperature: 0.7,
        });

        console.log("\n--- Response Received ---");
        console.log(`Provider used: ${response.provider}`);
        console.log(`Model used: ${response.model}`);
        console.log(`Content:\n${response.content}`);
    } catch (error: any) {
        console.error("Router failed:", error.message);
    }
}

main().catch(console.error);

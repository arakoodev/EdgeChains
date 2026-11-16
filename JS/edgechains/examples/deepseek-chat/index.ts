import { DeepSeekAI } from "@arakoodev/edgechains.js/ai";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const deepseek = new DeepSeekAI({ apiKey: process.env.DEEPSEEK_API_KEY });

    console.log("Sending request to DeepSeek...");

    try {
        const response = await deepseek.chat({
            model: "deepseek-chat",
            prompt: "What are the advantages of using DeepSeek-V3 for reasoning tasks?",
            temperature: 0.7,
        });

        console.log("\n--- Response Received ---");
        console.log(response.content);
    } catch (error: any) {
        console.error("DeepSeek request failed:", error.message);
    }
}

main().catch(console.error);

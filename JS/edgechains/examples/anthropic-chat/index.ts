import { AnthropicAI } from "@arakoodev/edgechains.js/ai";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const anthropic = new AnthropicAI({ apiKey: process.env.ANTHROPIC_API_KEY });

    console.log("Sending request to Anthropic Claude...");

    try {
        const response = await anthropic.chat({
            prompt: "What is the difference between a prompt and a chain in Generative AI?",
            max_tokens: 1024,
            temperature: 0.7,
        });

        console.log("\n--- Response Received ---");
        console.log(response.content[0].text);
    } catch (error: any) {
        console.error("Anthropic request failed:", error.message);
    }
}

main().catch(console.error);

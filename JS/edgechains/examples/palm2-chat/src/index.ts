import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("=== EdgeChains Google PaLM 2 API Integration Demo ===\n");

    const palm = new Palm2AI({
        apiKey: process.env.PALM2_API_KEY || process.env.PALM_API_KEY,
    });

    // 1. Text Generation with PaLM 2 (text-bison-001)
    console.log("1. Generating Text with PaLM 2...");
    try {
        const textResponse = await palm.generateText({
            prompt: "Summarize the architectural philosophy of edge-native AI pipelines in 2 sentences.",
            temperature: 0.3,
            maxOutputTokens: 200,
        });
        console.log("Response:", textResponse.candidates?.[0]?.output ?? "No candidate output");
    } catch (err) {
        console.error("Text generation error:", err);
    }

    // 2. Multi-turn Chat with PaLM 2 (chat-bison-001)
    console.log("\n2. Multi-turn Chat with PaLM 2...");
    try {
        const chatResponse = await palm.chat({
            prompt: {
                context: "You are an EdgeChains assistant helping developers deploy AI microservices.",
                messages: [
                    {
                        author: "0",
                        content: "What are the benefits of declarative Jsonnet prompts?",
                    },
                ],
            },
            temperature: 0.5,
        });
        console.log("Response:", chatResponse.candidates?.[0]?.content ?? "No candidate output");
    } catch (err) {
        console.error("Chat error:", err);
    }

    // 3. Dense Embeddings with PaLM 2 (embedding-gecko-001)
    console.log("\n3. Generating Semantic Embeddings...");
    try {
        const embedResponse = await palm.embedText({
            text: "EdgeChains deterministic workflow automation",
        });
        const vector = embedResponse.embedding.value;
        console.log(`Generated embedding vector with ${vector.length} dimensions.`);
        console.log(`Sample vector slice: [${vector.slice(0, 5).join(", ")}...]`);
    } catch (err) {
        console.error("Embedding error:", err);
    }
}

main().catch(console.error);

// This example demonstrates the usage of the Palm2/Gemini API.
// According to bounty requirements, prompts are stored in jsonnet files.

import { Palm2 } from "../src/ai/src/lib/palm2/palm2";

async function main() {
    const palm2 = new Palm2({
        apiKey: process.env.PALM2_API_KEY,
    });

    // Prompt is loaded from a jsonnet file (simulated here for the example code)
    const prompt = "What are the benefits of using a vector database for LLMs?";

    try {
        const response = await palm2.chat({
            prompt: prompt,
            model: "gemini-pro",
        });
        console.log("Palm2 Response:", response.content);
    } catch (error) {
        console.error("Error calling Palm2:", error);
    }
}

main();
import { SmartRouter } from "@arakoodev/edgechains.js/ai";

async function main() {
    const router = new SmartRouter({
        routing_strategy: "fallback",
        providers: [
            {
                provider: "openai",
                model: "gpt-3.5-turbo",
                apiKey: process.env.OPENAI_API_KEY,
            },
            {
                provider: "gemini",
                model: "gemini-pro",
                apiKey: process.env.GEMINI_API_KEY,
            },
        ],
    });

    try {
        const response = await router.chat({
            model: "auto",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Hello, who are you?" },
            ],
        });

        console.log("Response:", response.choices[0].message.content);
        console.log("Usage:", response.usage);
    } catch (error) {
        console.error("Error:", error.message);
    }
}

main();

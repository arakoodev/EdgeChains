import { Router } from "@arakoodev/edgechains.js/ai";

async function openAICall({ prompt, openAIApiKey }: { prompt: string; openAIApiKey: string }) {
    try {
        const router = new Router({ apiKey: openAIApiKey });
        const response = await router.chat({ prompt, max_tokens: 2000 });
        return JSON.stringify(response.content);
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

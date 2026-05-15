const { SmartRouter } = require("@arakoodev/edgechains.js/ai");
import { z } from "zod";

const schema = z.object({
    answer: z.string().describe("The answer to the question"),
});

async function openAICall({ prompt, openAIApiKey }: any) {
    try {
        const router = new SmartRouter({ deployments: [{ id: "default", provider: "openai", model: "gpt-3.5-turbo", apiKey: openAIApiKey }] });
        let res = await router.zodSchemaResponse({ prompt, schema: schema });
        return JSON.stringify(res);
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

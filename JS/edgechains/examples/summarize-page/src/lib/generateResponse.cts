const { OpenAI } = require("@arakoodev/edgechains.js/openai");
import { z } from "zod";

const schema = z.object({
    answer: z.string().describe("The answer to the question"),
});

async function openAICall({ prompt, openAIApiKey }: any) {
    try {
        const openai = new OpenAI({ apiKey: openAIApiKey });
        let res = await openai.zodSchemaResponse({ prompt, schema: schema });
        return JSON.stringify(res);
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

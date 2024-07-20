"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { OpenAI } = require("@arakoodev/edgechains.js/openai");
const zod_1 = require("zod");
const schema = zod_1.z.object({
    answer: zod_1.z.string().describe("The answer to the question"),
});
async function openAICall({ prompt, openAIApiKey }) {
    try {
        const openai = new OpenAI({ apiKey: openAIApiKey });
        let res = await openai.zodSchemaResponse({ prompt, schema: schema });
        return JSON.stringify(res);
    } catch (error) {
        return error;
    }
}
module.exports = openAICall;

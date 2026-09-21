const { Router } = require("@arakoodev/edgechains.js/ai");
const path = require("path");
const Jsonnet = require("@arakoodev/jsonnet");
import { z } from "zod";

const schema = z.object({
    answer: z.string().describe("The answer to the question"),
});

async function openAICall({ prompt, openAIApiKey }: any) {
    try {
        const jsonnet = new Jsonnet();
        jsonnet.extString("openai_api_key", openAIApiKey || "");
        const config = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/router.jsonnet"))
        );
        const router = new Router(config);
        let res = await router.zodSchemaResponse({ prompt, schema: schema });
        return JSON.stringify(res);
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

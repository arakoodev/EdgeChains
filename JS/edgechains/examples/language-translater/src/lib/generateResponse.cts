import { z } from "zod";
const path = require("path");
const { SmartRouter } = require("@arakoodev/edgechains.js/ai");

const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();
const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

const router = new SmartRouter({
    routingStrategy: "least-tokens",
    modelList: [
        {
            deploymentId: "openai-translator-primary",
            modelName: "gpt-3.5-turbo-16k",
            provider: "openai",
            model: "gpt-3.5-turbo-16k",
            apiKey: openAIApiKey,
        },
    ],
});

const schema = z.object({
    answer: z.string().describe("The answer to the question"),
});

function openAICall() {
    return function (prompt: string) {
        try {
            return router.zodSchemaResponse({ prompt, schema: schema }).then((res: any) => {
                return JSON.stringify(res);
            });
        } catch (error) {
            return error;
        }
    };
}

module.exports = openAICall;

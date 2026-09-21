const path = require("path");
const { Router } = require("@arakoodev/edgechains.js/ai");
const z = require("zod");
const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

jsonnet.extString("openai_api_key", openAIApiKey || "");
const routerConfig = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/router.jsonnet"))
);
const router = new Router(routerConfig);

const schema = z.object({
    answer: z.string().describe("The answer to the question"),
});

function openAICall() {
    return function (prompt: string) {
        try {
            return router
                .zodSchemaResponse({ prompt, schema, model: "gpt-3.5-turbo" })
                .then((res: any) => {
                    return JSON.stringify(res);
                });
        } catch (error) {
            return error;
        }
    };
}

module.exports = openAICall;

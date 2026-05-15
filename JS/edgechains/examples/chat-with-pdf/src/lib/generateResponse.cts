const path = require("path");
const { SmartRouter } = require("@arakoodev/edgechains.js/ai");
const z = require("zod");
const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

const router = new SmartRouter({ deployments: [{ id: "default", provider: "openai", model: "gpt-3.5-turbo", apiKey: openAIApiKey }] });

const schema = z.object({
    answer: z.string().describe("The answer to the question"),
});

function openAICall() {
    return function (prompt: string) {
        try {
            return router.zodSchemaResponse({ prompt, schema }).then((res: any) => {
                return JSON.stringify(res);
            });
        } catch (error) {
            return error;
        }
    };
}

module.exports = openAICall;

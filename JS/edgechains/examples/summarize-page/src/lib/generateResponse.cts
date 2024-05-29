const path = require("path");
const { OpenAI } = require("@arakoodev/edgechains.js/openai");
import { z } from "zod";
const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

const schema = z.object({
    answer: z.string().describe("The answer to the question"),
});

const openai = new OpenAI({
    apiKey: openAIApiKey,
    temperature: 0,
});

function openAICall() {
    return function (prompt: string) {
        try {
            return openai.zodSchemaResponse({ prompt, schema: schema }).then((res: any) => {
                console.log({ res });
                return JSON.stringify(res);
            });
        } catch (error) {
            return error;
        }
    };
}

module.exports = openAICall;

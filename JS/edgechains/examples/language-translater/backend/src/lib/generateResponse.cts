import { z } from "zod";
const path = require("path");
const { OpenAI } = require("arakoodev/openai");

const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();
const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key

const openai = new OpenAI({ apiKey: openAIApiKey })

const schema = z.object({
    answer: z.string().describe("The answer to the question")
})

function openAICall() {

    return function (prompt: string) {
        try {
            return openai.zodSchemaResponse({ prompt, schema: schema }).then((res: any) => {
                return JSON.stringify(res)
            })

        } catch (error) {
            return error;
        }
    }
}


module.exports = openAICall;
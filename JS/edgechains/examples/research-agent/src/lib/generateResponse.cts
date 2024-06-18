import path from "path";
import { OpenAI } from "@arakoodev/edgechains.js/openai";
import Jsonnet from "@arakoodev/jsonnet";

const jsonnet = new Jsonnet();
const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

const openai = new OpenAI({ apiKey: openAIApiKey });

function openAICall(prompt: any) {
    try {
        return openai.chat({ prompt, max_tokens: 2000 }).then((res: any) => {
            return JSON.stringify(res.content);
        });
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

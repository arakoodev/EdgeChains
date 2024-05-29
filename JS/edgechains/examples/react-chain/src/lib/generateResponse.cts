const path = require("path");
const { OpenAI } = require("@arakoodev/edgechains.js/openai");

const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

const openai = new OpenAI({
    apiKey: openAIApiKey,
    temperature: 0,
});

function openAICall() {
    return function (prompt: string) {
        try {
            return openai.chat({ prompt }).then((res: any) => {
                return res.content;
            });
        } catch (error) {
            return error;
        }
    };
}

module.exports = openAICall;

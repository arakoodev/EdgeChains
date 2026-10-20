const { OpenAI } = require("@arakoodev/edgechains.js/openai");

const path = require("path");
const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const apiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

const openai = new OpenAI({
    apiKey,
});

interface messageOption {
    prompt: string;
    functions: object | Array<object>;
}

function openAIFunction() {
    return ({ prompt, functions }: messageOption) => {
        try {
            const completion = openai
                .chatWithFunction({
                    model: "gpt-3.5-turbo-0613",
                    messages: [{ role: "user", content: prompt }],
                    functions,
                    function_call: "auto",
                })
                .then((completion: any) => {
                    return JSON.stringify(completion);
                })
                .catch((error: any) => {
                    console.error(error);
                });
            return completion;
        } catch (error) {
            console.error(error);
        }
    };
}

module.exports = openAIFunction;

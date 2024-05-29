const { OpenAI } = require("arakoodev/openai");

const path = require('path');
const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const apiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key

const openai = new OpenAI({
    apiKey
})

function openAIChat() {

    return ((prompt: string) => {
        try {
            const completion = openai.chat({
                model: "gpt-3.5-turbo-0613",
                messages: [{ role: "user", content: "Summarize the following input." + prompt }]
            }).then((completion: any) => {
                return JSON.stringify(completion);
            }
            ).catch((error: any) => {
                console.error(error);
            })
            return completion
        } catch (error) {
            console.error(error);
        }
    })
}

module.exports = openAIChat;
const path = require("path");
const { ChatOpenAi } = require("arakoodev/openai");

const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key

const openai = new ChatOpenAi({
    openAIApiKey,
    temperature: 0,
})


function openAICall() {

    return function (prompt: string) {
        try {
            return openai.generateResponse(prompt).then((res: any) => {
                return res
            })

        } catch (error) {
            return error;
        }
    }

}


module.exports = openAICall;
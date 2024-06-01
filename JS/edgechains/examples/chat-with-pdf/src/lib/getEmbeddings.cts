const { OpenAI } = require("@arakoodev/edgechains.js/openai")
const path = require("path");
const Jsonnet = require("@arakoodev/jsonnet");

const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

const llm = new OpenAI({
    apiKey: openAIApiKey
});

function getEmbeddings() {
    return ((content: any) => {
        const embeddings = llm.generateEmbeddings(content).then((res: any) => {
            return JSON.stringify(res)
        })
        return embeddings;
    })
}

module.exports = getEmbeddings;

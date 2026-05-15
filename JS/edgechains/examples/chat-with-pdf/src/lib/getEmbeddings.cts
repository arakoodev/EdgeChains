const { SmartRouter } = require("@arakoodev/edgechains.js/ai");
const path = require("path");
const Jsonnet = require("@arakoodev/jsonnet");

const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

const llm = new SmartRouter({
    deployments: [{
        id: "default",
        provider: "openai",
        model: "gpt-3.5-turbo",
        apiKey: openAIApiKey
    }]
});

function getEmbeddings() {
    return (content: any) => {
        const embeddings = llm.generateEmbeddings(content).then((res: any) => {
            return JSON.stringify(res);
        });
        return embeddings;
    };
}

module.exports = getEmbeddings;

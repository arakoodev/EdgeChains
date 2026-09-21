const { Router } = require("@arakoodev/edgechains.js/ai");
const path = require("path");
const Jsonnet = require("@arakoodev/jsonnet");

const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

jsonnet.extString("openai_api_key", openAIApiKey || "");
const routerConfig = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/router.jsonnet"))
);
const router = new Router(routerConfig);

function getEmbeddings() {
    return (content: any) => {
        const embeddings = router
            .embedding({ input: content, model: "text-embedding-ada-002" })
            .then((res: any) => {
                return JSON.stringify(res.data);
            });
        return embeddings;
    };
}

module.exports = getEmbeddings;

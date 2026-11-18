const { Router } = require("@arakoodev/edgechains.js/ai");
const path = require("path");
const Jsonnet = require("@arakoodev/jsonnet");

async function openAICall({ prompt, apiKey }: any) {
    try {
        const jsonnet = new Jsonnet();
        jsonnet.extString("openai_api_key", apiKey || "");
        const config = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/router.jsonnet"))
        );
        const router = new Router(config);
        const res = await router.completion({ prompt });
        return res.content;
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

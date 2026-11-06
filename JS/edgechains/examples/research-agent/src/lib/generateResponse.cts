const { Router } = require("@arakoodev/edgechains.js/ai");
const path = require("path");
const Jsonnet = require("@arakoodev/jsonnet");

async function openAICall({ prompt, openAIApiKey }: { prompt: string; openAIApiKey: string }) {
    try {
        const jsonnet = new Jsonnet();
        jsonnet.extString("openai_api_key", openAIApiKey || "");
        const config = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/router.jsonnet"))
        );
        const router = new Router(config);
        const response = await router.completion({ prompt, max_tokens: 2000 });
        return JSON.stringify(response.content);
    } catch (error) {
        return error;
    }
}

module.exports = openAICall;

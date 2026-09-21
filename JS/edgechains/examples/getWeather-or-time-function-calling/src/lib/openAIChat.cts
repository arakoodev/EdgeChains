const { Router } = require("@arakoodev/edgechains.js/ai");

const path = require("path");
const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const apiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

jsonnet.extString("openai_api_key", apiKey || "");
const routerConfig = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/router.jsonnet"))
);
const router = new Router(routerConfig);

function openAIChat() {
    return (prompt: string) => {
        try {
            const completion = router
                .completion({
                    messages: [
                        { role: "user", content: "Summarize the following input." + prompt },
                    ],
                })
                .then((res: any) => {
                    return JSON.stringify({ content: res.content });
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

module.exports = openAIChat;

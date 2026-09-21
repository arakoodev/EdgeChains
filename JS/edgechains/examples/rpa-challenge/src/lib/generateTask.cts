const { Router } = require("@arakoodev/edgechains.js/ai");
const path = require("path");
const Jsonnet = require("@arakoodev/jsonnet");

function openAICall({
    prompt,
    functions,
    openAIKey,
}: {
    prompt: string;
    functions: any;
    openAIKey: string;
}) {
    try {
        const jsonnet = new Jsonnet();
        jsonnet.extString("openai_api_key", openAIKey || "");
        const config = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/router.jsonnet"))
        );
        const router = new Router(config);
        const completion = router
            .completion({
                messages: [{ role: "user", content: prompt }],
                max_tokens: 1024,
                functions,
                function_call: { name: functions[0].name },
            })
            .then((res: any) => {
                return JSON.stringify(JSON.parse(res.functionCall.arguments).tasks);
            })
            .catch((error: any) => {
                console.error(error);
            });
        return completion;
    } catch (error) {
        console.error(error);
    }
}

module.exports = openAICall;

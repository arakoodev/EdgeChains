const { OpenAI } = require("@arakoodev/edgechains.js/ai");

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
        const openai = new OpenAI({ apiKey: openAIKey });
        const completion = openai
            .chatWithFunction({
                model: "gpt-3.5-turbo-0613",
                messages: [{ role: "user", content: prompt }],
                functions,
                function_call: { name: functions[0].name },
            })
            .then((completion: any) => {
                return JSON.stringify(JSON.parse(completion.function_call.arguments).tasks);
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

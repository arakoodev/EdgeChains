const { Palm2AI } = require("@arakoodev/edgechains.js/ai");

function generateResponse(options: {
    prompt: string;
    palmApiKey: string;
    model?: "text-bison-001" | "models/text-bison-001";
    temperature?: number;
}) {
    const palm2 = new Palm2AI({ apiKey: options.palmApiKey });
    return palm2
        .generateText({
            prompt: options.prompt,
            model: options.model || "text-bison-001",
            temperature: options.temperature ?? 0.4,
        })
        .then((res: string) => {
            return JSON.stringify({ answer: res });
        });
}

module.exports = generateResponse;

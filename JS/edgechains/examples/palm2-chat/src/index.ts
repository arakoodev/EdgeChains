import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
    const jsonnet = new Jsonnet();
    const apiKey = process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "dummy-key-for-evaluation";
    const question = process.argv.slice(2).join(" ") || "What is EdgeChains and how does it support PaLM2?";

    jsonnet.extString("PALM2_API_KEY", apiKey);
    jsonnet.extString("palm2_api_key", apiKey);
    jsonnet.extString("question", question);

    const mainJsonnetPath = path.join(__dirname, "../jsonnet/main.jsonnet");
    const evaluatedConfig = JSON.parse(jsonnet.evaluateFile(mainJsonnetPath));

    console.log("Evaluated Jsonnet Prompt Config:", evaluatedConfig);

    const palm2 = new Palm2AI({ apiKey: evaluatedConfig.apiKey });
    const response = await palm2.chat({
        model: evaluatedConfig.model,
        prompt: evaluatedConfig.prompt,
        temperature: evaluatedConfig.temperature,
        maxOutputTokens: evaluatedConfig.maxOutputTokens,
    });

    console.log("PaLM2 / Gemini Response:\n", response);
}

run().catch((err) => {
    console.error("Execution error:", err);
});

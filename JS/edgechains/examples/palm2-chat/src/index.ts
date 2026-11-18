import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    const jsonnet = new Jsonnet();
    const key = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
    ).google_api_key;
    jsonnet.extString("question", process.argv[2] || "What is the capital of France?");
    const promptConfig = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"))
    );

    const palm2 = new Palm2AI({ apiKey: key });
    const answer = await palm2.generateText({ prompt: promptConfig.prompt });

    console.log("Prompt:", promptConfig.prompt);
    console.log("Answer:", answer);
}

main().catch((error) => {
    console.error("Failed to chat with Palm2:", error);
    process.exit(1);
});

import path from "node:path";
import Jsonnet from "@arakoodev/jsonnet";
import { Palm2AI, type Palm2AIChatOptions } from "@arakoodev/edgechains.js/ai";

async function main() {
    if (!process.env.GEMINI_API_KEY)
        throw new Error("Set GEMINI_API_KEY before running this example.");
    const jsonnet = new Jsonnet();
    let options: Palm2AIChatOptions;
    try {
        options = JSON.parse(
            jsonnet.evaluateFile(
                path.join(__dirname, "../jsonnet/main.jsonnet"),
            ),
        );
    } finally {
        jsonnet.destroy();
    }
    const response = await new Palm2AI().chat(options);
    console.log(JSON.stringify(response, null, 2));
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});

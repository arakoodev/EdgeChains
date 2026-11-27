import { Palm2, type Palm2ChatOptions } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";

import fileURLToPath from "file-uri-to-path";
import path from "path";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Palm2JsonnetConfig extends Palm2ChatOptions {
    apiKey: string;
}

function evaluateConfig(): Palm2JsonnetConfig {
    const secrets = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet")),
    );
    jsonnet.extString("palm2_api_key", secrets.palm2_api_key);
    jsonnet.extString(
        "question",
        process.argv[2] || "Explain what a blockchain is in two sentences.",
    );
    return JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")));
}

async function main(): Promise<void> {
    const config = evaluateConfig();
    const palm2 = new Palm2({ apiKey: config.apiKey });

    try {
        const response = await palm2.chat(config);
        const answer = response.candidates?.[0]?.content;
        if (!answer) {
            console.error("Palm2 returned no candidates:", JSON.stringify(response, null, 4));
            process.exit(1);
        }
        console.log(answer);
    } catch (error) {
        console.error("Palm2 request failed:", error);
        process.exit(1);
    }
}

main();

import path from "node:path";

import Jsonnet from "@arakoodev/jsonnet";
import { Palm2AI } from "@arakoodev/edgechains.js/ai";

const jsonnet = new Jsonnet();
const config = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")));
const secrets = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet")));

async function main() {
    const palm2 = new Palm2AI({ apiKey: secrets.palm_api_key });
    const response = await palm2.chat({
        prompt: config.prompt,
        temperature: config.temperature,
        maxOutputTokens: config.max_output_tokens,
    });

    console.log(response.output);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

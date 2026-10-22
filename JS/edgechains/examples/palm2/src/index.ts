import Jsonnet from "@arakoodev/jsonnet";
import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const palm2Call = async ({ prompt, apiKey }: { prompt: string; apiKey: string }) => {
    const client = new Palm2AI({ apiKey });
    return JSON.stringify(await client.generateText({ prompt }));
};

export async function generate(prompt: string): Promise<string> {
    const secrets = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
    );
    jsonnet.extString("palm2_api_key", secrets.palm2_api_key);
    jsonnet.extString("prompt", prompt);
    jsonnet.javascriptCallback("palm2Call", palm2Call);
    return jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
}

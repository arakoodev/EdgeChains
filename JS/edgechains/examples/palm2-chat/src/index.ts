import Jsonnet from "@arakoodev/jsonnet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Palm2AI } from "@arakoodev/edgechains.js/ai";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const question = process.argv.slice(2).join(" ") || "Explain EdgeChains in one paragraph.";

jsonnet.extString("question", question);

const prompt = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"))
).prompt;

const secrets = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
);

const client = new Palm2AI({ apiKey: secrets.google_api_key });
const response = await client.chat({ prompt });

console.log(JSON.stringify(response, null, 2));

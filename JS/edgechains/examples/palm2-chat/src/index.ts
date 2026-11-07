import path from "path";
import { fileURLToPath } from "url";
import Jsonnet from "@arakoodev/jsonnet";
import { Palm2AI } from "@arakoodev/edgechains.js/ai";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

jsonnet.extString("PALM2_API_KEY", process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "");
jsonnet.extString("topic", process.env.TOPIC || "Jsonnet-driven LLM prompt pipelines");

const secrets = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet")));
const promptSpec = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")));

const client = new Palm2AI({ apiKey: secrets.palm2_api_key });
const response = await client.chat({
    model: promptSpec.model,
    prompt: promptSpec.prompt,
    temperature: promptSpec.temperature,
    maxOutputTokens: promptSpec.maxOutputTokens,
});

console.log(JSON.stringify(response, null, 2));

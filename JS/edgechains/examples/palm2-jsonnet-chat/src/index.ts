import Jsonnet from "@arakoodev/jsonnet";
import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const question = process.argv.slice(2).join(" ") || "What is EdgeChains?";

jsonnet.extString("question", question);

const promptConfig = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"))
) as {
    model: string;
    prompt: string;
    temperature: number;
    maxOutputTokens: number;
};

const secrets = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
) as { google_api_key: string };

const client = new Palm2AI({ apiKey: process.env.GEMINI_API_KEY || secrets.google_api_key });

const response = await client.generateText({
    model: promptConfig.model,
    prompt: promptConfig.prompt,
    temperature: promptConfig.temperature,
    maxOutputTokens: promptConfig.maxOutputTokens,
});

console.log(response);

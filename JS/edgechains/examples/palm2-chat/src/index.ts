import { GeminiAI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnet = new Jsonnet();

jsonnet.extString("question", process.argv.slice(2).join(" ") || "What is EdgeChains?");
const promptConfig = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")));

const gemini = new GeminiAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await gemini.chat(promptConfig);

console.log(JSON.stringify(response, null, 2));

import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import path from "node:path";
import { fileURLToPath } from "node:url";

const jsonnet = new Jsonnet();
const directory = path.dirname(fileURLToPath(import.meta.url));
const { prompt } = JSON.parse(
    jsonnet.evaluateFile(path.join(directory, "../jsonnet/main.jsonnet"))
) as { prompt: string };

const palm2 = new Palm2AI({ apiKey: process.env.GEMINI_API_KEY });
const response = await palm2.chat({ prompt });
console.log(response.candidates[0]?.content.parts[0]?.text ?? "No response");

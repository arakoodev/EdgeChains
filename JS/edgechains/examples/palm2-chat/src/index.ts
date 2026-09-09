import { GeminiAI, GeminiAIChatOptions } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Palm2ExampleConfig = {
  model: string;
  prompt: string;
  generation: Pick<
    GeminiAIChatOptions,
    "temperature" | "max_output_tokens" | "responseType" | "top_p" | "top_k"
  >;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnet = new Jsonnet();
const config = JSON.parse(
  jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")),
) as Palm2ExampleConfig;
const chatOptions: GeminiAIChatOptions = {
  model: config.model,
  prompt: config.prompt,
  ...config.generation,
};

if (!process.env.GEMINI_API_KEY) {
  console.log("Dry run: set GEMINI_API_KEY to call the live API.");
  console.log(JSON.stringify(chatOptions, null, 2));
} else {
  const gemini = new GeminiAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await gemini.chat(chatOptions);
  console.log(JSON.stringify(response, null, 2));
}

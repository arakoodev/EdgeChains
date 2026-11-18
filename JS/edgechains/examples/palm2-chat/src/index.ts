import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

jsonnet.extString("GEMINI_API_KEY", process.env.GEMINI_API_KEY || "");
jsonnet.extString("gemini_api_key", process.env.GEMINI_API_KEY || "");
jsonnet.extString(
  "question",
  process.env.PALM2_QUESTION || "What can Gemini do?",
);

const promptConfig = JSON.parse(
  jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")),
);

const palm2 = new Palm2AI({ apiKey: promptConfig.apiKey });

const response = await palm2.chat({
  model: promptConfig.model,
  prompt: promptConfig.prompt,
  responseType: promptConfig.responseType,
  temperature: promptConfig.temperature,
  maxOutputTokens: promptConfig.maxOutputTokens,
});

console.log(JSON.stringify(response, null, 2));

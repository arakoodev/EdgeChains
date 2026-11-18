import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnet = new Jsonnet();

jsonnet.extString(
  "question",
  process.argv.slice(2).join(" ") || "What is EdgeChains?",
);

const chatOptions = JSON.parse(
  jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")),
);
const palm2 = new Palm2AI({ apiKey: process.env.GEMINI_API_KEY });

const response = await palm2.chat(chatOptions);
console.log(JSON.stringify(response, null, 2));

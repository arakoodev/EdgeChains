import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import { fileURLToPath } from "url";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

jsonnet.extString("topic", process.env.TOPIC ?? "retrieval augmented generation");

const config = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")));
const palm2 = new Palm2AI({ apiKey: process.env.GOOGLE_API_KEY });
const response = await palm2.chat(config);

console.log(JSON.stringify(response, null, 2));

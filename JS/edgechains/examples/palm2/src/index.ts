import Jsonnet from "@arakoodev/jsonnet";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Palm2AI } from "@arakoodev/edgechains.js/ai";

const question = process.env.PALM2_QUESTION;
if (!question) {
  throw new Error("Set PALM2_QUESTION to run the example.");
}

const jsonnet = new Jsonnet();
jsonnet.extString("question", question);

const directory = path.dirname(fileURLToPath(import.meta.url));
const request = JSON.parse(
  jsonnet.evaluateFile(path.join(directory, "../jsonnet/main.jsonnet")),
);

const client = new Palm2AI({ apiKey: process.env.PALM_API_KEY });
const response = await client.chat(request);
console.log(response.candidates?.[0]?.content || "No candidate returned");

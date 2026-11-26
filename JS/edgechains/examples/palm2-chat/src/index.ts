import { GeminiAI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Prompts live in Jsonnet - nothing is hardcoded here (issue #279 rule).
const jsonnet = new Jsonnet();
const promptFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../jsonnet/prompts.jsonnet"
);
const question = process.argv[2] ?? "What does EdgeChains do?";
jsonnet.extString("question", question);
const { prompt, systemInstruction } = JSON.parse(jsonnet.evaluateFile(promptFile));

// PaLM 2 is retired; this endpoint uses the Gemini generateContent API.
// Use GEMINI_BASE_URL to point at a proxy/local fixture for offline demos.
const client = new GeminiAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseUrl: process.env.GEMINI_BASE_URL,
    model: process.env.GEMINI_MODEL,
});

const response = await client.chat({ prompt, systemInstruction });
console.log(response.candidates?.map((c) => c.content.parts.map((p) => p.text).join("")).join("\n"));

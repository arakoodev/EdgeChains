import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const secrets = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
);
const apiKey: string = secrets.palm_api_key;

// Prompts and model parameters live in jsonnet/main.jsonnet, not in this file.
jsonnet.extString("topic", process.argv[2] || "Lineage 2");
jsonnet.extString("question", process.argv[3] || "Which classes heal the most?");
jsonnet.extString("race", process.argv[4] || "Elven");
const config = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"))
);

// No API key configured -> deterministic mock so the example runs 100% offline (CI mode).
const offline = !apiKey || apiKey === "YOUR_PALM2_API_KEY";
const mockCaller = async (url: string) => {
    if (url.includes(":embedText")) return { embedding: { value: [0.11, 0.22, 0.33] } };
    if (url.includes(":generateMessage"))
        return { candidates: [{ author: "Model", content: "[mock chat response]" }] };
    return { candidates: [{ output: "[mock text response]", index: 0 }] };
};

const palm = new Palm2AI({ apiKey: offline ? undefined : apiKey, mockCaller: offline ? mockCaller : undefined });
console.log(offline ? "No PALM2 key found in jsonnet/secrets.jsonnet - running with mock responses.\n" : "Using live PaLM 2 API.\n");

const text = await palm.generateText(config.generateText);
console.log("generateText:", text.candidates?.[0]?.output ?? text);

const chat = await palm.chat(config.chat);
console.log("chat:", chat.candidates?.[0]?.content ?? chat);

const embeddings = await palm.generateEmbeddings(
    config.embeddings.text,
    config.embeddings.model
);
console.log("embeddings: vector of length", embeddings.embedding.value.length);

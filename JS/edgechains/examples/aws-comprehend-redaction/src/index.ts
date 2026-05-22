import { AWSComprehendRedactor, type ComprehendClient } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnet = new Jsonnet();

jsonnet.extString("customer_message", "My name is John and my email is john@example.com.");
const config = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")));

const mockComprehendClient: ComprehendClient = {
    detectPiiEntities: async () => ({
        Entities: [{ Type: "EMAIL", Score: 0.99, BeginOffset: 57, EndOffset: 73 }],
    }),
};

const redactor = new AWSComprehendRedactor({
    client: mockComprehendClient,
    minScore: config.minScore,
    replacement: config.replacement,
});

console.log(await redactor.redactPromptOptions({ prompt: config.prompt }));

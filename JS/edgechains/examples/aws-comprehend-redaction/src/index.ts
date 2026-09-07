import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { AWSComprehend, OpenAI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";
import { createDemoComprehendClient } from "./lib/demoComprehendClient.js";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isPlaceholder(value?: string) {
    return !value || /your-|^\*+$|\*\*\*|sk-proj-\*\*\*/i.test(value);
}

function loadSecrets() {
    return JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet")));
}

function loadPrompt(question: string) {
    jsonnet.extString("question", question || "");
    const rendered = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
    return JSON.parse(rendered).prompt as string;
}

function createRedactor(secrets: {
    aws_region?: string;
    aws_access_key_id?: string;
    aws_secret_access_key?: string;
}) {
    const useDemo =
        process.env.COMPREHEND_DEMO === "1" ||
        isPlaceholder(secrets.aws_access_key_id) ||
        isPlaceholder(secrets.aws_secret_access_key);

    return new AWSComprehend({
        region: secrets.aws_region || "us-east-1",
        accessKeyId: useDemo ? undefined : secrets.aws_access_key_id,
        secretAccessKey: useDemo ? undefined : secrets.aws_secret_access_key,
        client: useDemo ? createDemoComprehendClient() : undefined,
    });
}

app.post("/chat", async (c: any) => {
    try {
        const { question } = await c.req.json();
        const secrets = loadSecrets();
        const prompt = loadPrompt(question);
        const comprehend = createRedactor(secrets);
        const redactedPrompt = await comprehend.redactPrompt(prompt);

        if (isPlaceholder(secrets.openai_api_key)) {
            return c.json({
                redactedPrompt,
                response: {
                    content:
                        "OpenAI API key is not configured. Returning the redacted prompt only.",
                },
            });
        }

        const openai = new OpenAI({ apiKey: secrets.openai_api_key });
        const response = await comprehend.chain(openai).chat({ prompt, max_tokens: 256 });
        return c.json({ redactedPrompt, response });
    } catch (error) {
        console.log("error occured", error);
        return c.json({ error: String(error) }, 500);
    }
});

app.post("/redact", async (c: any) => {
    try {
        const { text } = await c.req.json();
        const secrets = loadSecrets();
        const comprehend = createRedactor(secrets);
        const redactedPrompt = await comprehend.redactPrompt(text || "");
        return c.json({ redactedPrompt });
    } catch (error) {
        console.log("error occured", error);
        return c.json({ error: String(error) }, 500);
    }
});

server.listen(3000);

import { AWSComprehend, OpenAI } from "@arakoodev/edgechains.js/ai";
import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
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
        const redaction = await comprehend.redact(prompt);

        if (isPlaceholder(secrets.openai_api_key)) {
            return c.json({
                labels: redaction.labels,
                redactedPrompt: redaction.redactedText,
                response: {
                    content:
                        "OpenAI API key is not configured. Returning the redacted prompt only.",
                },
            });
        }

        const openai = new OpenAI({ apiKey: secrets.openai_api_key });
        const response = await comprehend.chain(openai).chat({ prompt, max_tokens: 256 });
        return c.json({
            labels: redaction.labels,
            redactedPrompt: redaction.redactedText,
            response,
        });
    } catch (error) {
        console.log("error occured", error);
        return c.json({ error: String(error) }, 500);
    }
});

app.post("/redact", async (c: any) => {
    try {
        const { maskMode, text } = await c.req.json();
        const secrets = loadSecrets();
        const comprehend = createRedactor(secrets);
        const result = await comprehend.redact({
            maskMode: maskMode === "MASK" ? "MASK" : "REPLACE_WITH_PII_ENTITY_TYPE",
            text: text || "",
        });
        return c.json(result);
    } catch (error) {
        console.log("error occured", error);
        return c.json({ error: String(error) }, 500);
    }
});

app.post("/transcript", async (c: any) => {
    try {
        const { turns } = await c.req.json();
        const secrets = loadSecrets();
        const comprehend = createRedactor(secrets);
        return c.json(await comprehend.redactTranscript(turns || []));
    } catch (error) {
        console.log("error occured", error);
        return c.json({ error: String(error) }, 500);
    }
});

server.listen(3000);

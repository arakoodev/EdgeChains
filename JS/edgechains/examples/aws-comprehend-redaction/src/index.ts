import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const openAICall = createSyncRPC(path.join(__dirname, "./lib/generateResponse.cjs"));
const redactPii = createSyncRPC(path.join(__dirname, "./lib/redactPii.cjs"));

function loadSecrets() {
    return JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet")));
}

app.post("/chat", async (c: any) => {
    try {
        const { question } = await c.req.json();
        const secrets = loadSecrets();
        jsonnet.extString("openai_api_key", secrets.openai_api_key || "");
        jsonnet.extString("aws_region", secrets.aws_region || "us-east-1");
        jsonnet.extString("aws_access_key_id", secrets.aws_access_key_id || "");
        jsonnet.extString("aws_secret_access_key", secrets.aws_secret_access_key || "");
        jsonnet.extString("comprehend_demo", process.env.COMPREHEND_DEMO === "1" ? "1" : "0");
        jsonnet.extString("question", question || "");
        jsonnet.javascriptCallback("openAICall", openAICall);
        jsonnet.javascriptCallback("redactPii", redactPii);
        const response = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
        return c.json(JSON.parse(response));
    } catch (error) {
        console.log("error occured", error);
        return c.json({ error: String(error) }, 500);
    }
});

app.post("/redact", async (c: any) => {
    try {
        const { text } = await c.req.json();
        const secrets = loadSecrets();
        jsonnet.extString("openai_api_key", secrets.openai_api_key || "");
        jsonnet.extString("aws_region", secrets.aws_region || "us-east-1");
        jsonnet.extString("aws_access_key_id", secrets.aws_access_key_id || "");
        jsonnet.extString("aws_secret_access_key", secrets.aws_secret_access_key || "");
        jsonnet.extString("comprehend_demo", process.env.COMPREHEND_DEMO === "1" ? "1" : "0");
        jsonnet.extString("question", text || "");
        jsonnet.javascriptCallback("openAICall", openAICall);
        jsonnet.javascriptCallback("redactPii", redactPii);
        const response = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"))
        );
        return c.json({ redactedPrompt: response.redactedPrompt });
    } catch (error) {
        console.log("error occured", error);
        return c.json({ error: String(error) }, 500);
    }
});

server.listen(3000);

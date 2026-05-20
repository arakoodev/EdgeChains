import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const redactedOpenAICall = createSyncRPC(path.join(__dirname, "./lib/redactedOpenAICall.cjs"));

app.post("/redact-and-chat", async (c: any) => {
    const { input } = await c.req.json();
    const key = process.env.OPENAI_API_KEY || "";

    jsonnet.extString("openai_api_key", key);
    jsonnet.extString("input", input || "");
    jsonnet.javascriptCallback("redactedOpenAICall", redactedOpenAICall);

    const response = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
    return c.json(JSON.parse(response));
});

server.listen(3000);

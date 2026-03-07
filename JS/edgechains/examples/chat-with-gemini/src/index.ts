import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";

import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";

import fileURLToPath from "file-uri-to-path";
import path from "path";
const server = new ArakooServer();

const app = server.createApp();

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const geminiCall = createSyncRPC(path.join(__dirname, "./lib/generateResponse.cjs"));

app.post("/chat", async (c: any) => {
    try {
        const { question } = await c.req.json();
        const key = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
        ).gemini_api_key;
        jsonnet.extString("gemini_api_key", key);
        jsonnet.extString("question", question || "");
        jsonnet.javascriptCallback("geminiCall", geminiCall);
        let response = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
        return c.json(JSON.parse(response));
    } catch (error) {
        console.log("error occurred", error);
    }
});

server.listen(3000);

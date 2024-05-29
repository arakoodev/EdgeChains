
import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
//@ts-ignore
import createClient from 'sync-rpc';

import { fileURLToPath } from "url"
import path from "path";
const server = new ArakooServer();

const app = server.createApp();

const jsonnet = new Jsonnet();
const __dirname = fileURLToPath(import.meta.url);

const openAICall = createClient(path.join(__dirname, "../lib/generateResponse.cjs"));

app.post("/chat", async (c: any) => {
    const { question } = await c.req.json();
    jsonnet.extString("question", question || "");
    jsonnet.javascriptCallback("openAICall", openAICall);
    let response = jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet"));
    return c.json(JSON.parse(response));
});

server.listen(3000)



import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";

import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";

import fileURLToPath from "file-uri-to-path";
import path from "path";
const server = new ArakooServer();

const app = server.createApp();

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const treeOfThoughts = createSyncRPC(path.join(__dirname, "./lib/generateResponse.cjs"));

app.post("/tot", async (c: any) => {
    try {
        const { problem } = await c.req.json();
        const key = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
        ).openai_api_key;
        jsonnet.extString("openai_api_key", key);
        jsonnet.extString("problem", problem || "");
        jsonnet.javascriptCallback("treeOfThoughts", treeOfThoughts);
        const response = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
        return c.json(JSON.parse(response));
    } catch (error) {
        console.log("error occured", error);
    }
});

server.listen(3000);
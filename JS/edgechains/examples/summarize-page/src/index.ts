import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
//@ts-ignore
import createClient from "@arakoodev/edgechains.js/sync-rpc";

import fileURLToPath from "file-uri-to-path";
import path from "path";
const server = new ArakooServer();

const app = server.createApp();

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openAICall = createClient(path.join(__dirname, "./lib/generateResponse.cjs"));
const getPageContent = createClient(path.join(__dirname, "./lib/getDataFromUrl.cjs"));


app.get("/", async (c: any) => {
    const pageUrl = c.req.query("pageUrl");
    const key = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
    ).openai_api_key;
    jsonnet.extString("pageUrl", pageUrl || "");
    jsonnet.extString("openai_api_key", key);
    jsonnet.javascriptCallback("openAICall", openAICall);
    jsonnet.javascriptCallback("getPageContent", getPageContent);
    let response = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
    return c.json(response);
});

server.listen(3000);

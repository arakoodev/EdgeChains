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
const call = createClient(path.join(__dirname, "./lib/playwright.cjs"));
app.get("/", async (c: any) => {
    const key = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
    ).openai_api_key;

    jsonnet.extString("openai_api_key", key);
    jsonnet.javascriptCallback("call", call);
    let response = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
    return c.text(response);
});

server.listen(3000);


import { ArakooServer } from "arakoodev/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
//@ts-ignore
import createClient from 'sync-rpc';
import { fileURLToPath } from "url"
import path from "path";
const server = new ArakooServer();

const app = server.createApp();

server.useCors()

const jsonnet = new Jsonnet();
const __dirname = fileURLToPath(import.meta.url);

const openAICall = createClient(path.join(__dirname, "../lib/generateResponse.cjs"));

app.post("/translate", async (c: any) => {
    const { language, text } = await c.req.json();
    jsonnet.extString("language", language || "");
    jsonnet.extString("text", text || "");
    jsonnet.javascriptCallback("openAICall", openAICall);
    let response = jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet"));
    return c.json(response);
});

server.listen(3000)


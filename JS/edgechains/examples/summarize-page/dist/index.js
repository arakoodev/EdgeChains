import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
//@ts-ignore
import createClient from "sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";
const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = fileURLToPath(import.meta.url);
const openAICall = createClient(path.join(__dirname, "../lib/generateResponse.cjs"));
const getPageContent = createClient(path.join(__dirname, "../lib/getDataFromUrl.cjs"));
app.get("/", async (c) => {
    const pageUrl = c.req.query("pageUrl");
    jsonnet.extString("pageUrl", pageUrl || "");
    jsonnet.javascriptCallback("openAICall", openAICall);
    jsonnet.javascriptCallback("getPageContent", getPageContent);
    let response = jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet"));
    console.log(response);
    return c.json(response);
});
server.listen(3000);

import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
//@ts-ignore
import createClient from "@arakoodev/edgechains.js/sync-rpc"
import Home from "./pages/Home.js";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";
import { response } from "express";

const server = new ArakooServer();
const jsonnet = new Jsonnet()
const app = server.createApp();

const __dirname = fileURLToPath(import.meta.url);

const openAICall = createClient(path.join(__dirname, "../lib/generateResponse.cjs"));
const bingWebSearch = createClient(path.join(__dirname, "../lib/bingWebSearch.cjs"))
const WebScraper = createClient(path.join(__dirname, "../lib/scrapPageContent.cjs"));

app.get("/", (c: any) => {
    return c.html(<Home />);
});

app.post("/research", async (c: any) => {
    console.time("Time taken")
    const { query } = await c.req.parseBody();
    jsonnet.extString("query", query);
    jsonnet.javascriptCallback("openAICall", openAICall);
    jsonnet.javascriptCallback("bingWebSearch", bingWebSearch)
    jsonnet.javascriptCallback("webScraper", WebScraper)
    const data = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet")));
    const response = data.replace(/\\n/g, '<br/>')
        .replace(/\\\"/g, '"')
        .replace(/##\s/g, '<h2>')
        .replace(/###\s/g, '<h3>')
        .replace(/#\s/g, '<h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    console.timeEnd("Time taken")
    return c.json(response);
})


server.listen(3000)

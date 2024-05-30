import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { fileURLToPath } from "url";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";

//@ts-ignore
import createClient from "sync-rpc";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();

const __dirname = fileURLToPath(import.meta.url);

const openAIChat = createClient(path.join(__dirname, "../lib/openAIChat.cjs"));
const openAIFunction = createClient(path.join(__dirname, "../lib/openAIFunction.cjs"));
const lookupTime = createClient(path.join(__dirname, "../lib/lookupTime.cjs"));
const lookupWeather = createClient(path.join(__dirname, "../lib/lookupWeather.cjs"));

app.get("/", async (c) => {
    const { question } = c.req.query();
    jsonnet.extString("user_input", question);
    jsonnet.javascriptCallback("lookupTime", lookupTime);
    jsonnet.javascriptCallback("lookupWeather", lookupWeather);
    jsonnet.javascriptCallback("openAIChat", openAIChat);
    jsonnet.javascriptCallback("openAIFunction", openAIFunction);
    const response = jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet"));
    return c.json(response);
});

server.listen(3000);

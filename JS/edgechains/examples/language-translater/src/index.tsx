import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Home from "./pages/Home.js";
import Jsonnet from "@arakoodev/jsonnet";
//@ts-ignore
import createClient from "sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";
const server = new ArakooServer();

const app = server.createApp();

server.useCors();

const jsonnet = new Jsonnet();
const __dirname = fileURLToPath(import.meta.url);

const openAICall = createClient(path.join(__dirname, "../lib/generateResponse.cjs"));

app.get("/", (c: any) => {
    return c.html(<Home />);
});

app.post("/translate", async (c: any) => {
    const { language, text } = await c.req.parseBody();
    jsonnet.extString("language", language || "");
    jsonnet.extString("text", text || "");
    jsonnet.javascriptCallback("openAICall", openAICall);
    let response = await JSON.parse(
        JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet")))
    );
    return c.text("Your text is :  " + response.answer);
});

server.listen(3000);

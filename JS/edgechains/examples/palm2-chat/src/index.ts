import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const palm2Call = createSyncRPC(path.join(__dirname, "./lib/generateResponse.cjs"));

app.post("/chat", async (c: any) => {
    try {
        const { question } = await c.req.json();
        const secrets = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
        );
        const apiKey = secrets.palm2_api_key || process.env.PALM2_API_KEY || "";

        jsonnet.extString("palm2_api_key", apiKey);
        jsonnet.extString("question", question || "Hello from EdgeChains!");
        jsonnet.javascriptCallback("palm2Call", palm2Call);

        const rendered = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
        return c.json(JSON.parse(rendered));
    } catch (error: any) {
        return c.json({ error: error.message || String(error) }, 500);
    }
});

server.listen(3000);
console.log("PaLM 2 EdgeChains Server listening on port 3000");

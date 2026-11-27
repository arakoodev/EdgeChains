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
        const key = process.env.PALM2_API_KEY || "";
        jsonnet.extString("palm2_api_key", key);
        jsonnet.extString("question", question || "");
        jsonnet.javascriptCallback("palm2Call", palm2Call);
        const response = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
        return c.json(JSON.parse(response));
    } catch (error) {
        console.error("Error occurred during PaLM 2 evaluation:", error);
        return c.json({ error: "Failed to generate response" }, 500);
    }
});

server.listen(3000);

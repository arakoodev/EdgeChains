import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const awsRedact = createSyncRPC(path.join(__dirname, "./lib/awsRedact.cjs"));

app.post("/redact", async (c: any) => {
    try {
        const { text } = await c.req.json();
        jsonnet.extString("text", text || "");
        jsonnet.javascriptCallback("awsRedact", awsRedact);
        let response = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
        return c.json(JSON.parse(response));
    } catch (error) {
        console.log("error occured", error);
        return c.json({ error: "Internal Server Error" }, 500);
    }
});

server.listen(3000);
console.log("Server running on http://localhost:3000/redact");

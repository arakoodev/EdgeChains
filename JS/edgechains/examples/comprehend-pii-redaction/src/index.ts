import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const redactAndChatCall = createSyncRPC(path.join(__dirname, "./lib/redactAndChat.cjs"));

app.post("/redact-chat", async (c: any) => {
    try {
        const { transcript } = await c.req.json();
        const secrets = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
        );

        jsonnet.extString("openai_api_key", secrets.openai_api_key);
        jsonnet.extString("aws_access_key_id", secrets.aws_access_key_id);
        jsonnet.extString("aws_secret_access_key", secrets.aws_secret_access_key);
        jsonnet.extString("aws_region", secrets.aws_region || "us-east-1");
        jsonnet.extString("transcript", transcript || "");
        jsonnet.javascriptCallback("redactAndChatCall", redactAndChatCall);

        const response = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
        return c.json(JSON.parse(response));
    } catch (error) {
        console.error("Error in /redact-chat:", error);
        return c.json({ error: String(error) }, 500);
    }
});

server.listen(3000);

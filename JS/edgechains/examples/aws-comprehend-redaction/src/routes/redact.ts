import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";
//@ts-ignore
import createClient from "@arakoodev/edgechains.js/sync-rpc";

const server = new ArakooServer();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { redactPrompt, openAIChatWithRedaction } = createClient(
    path.join(__dirname, "../lib/redactAndGenerate.cjs")
);

export const RedactRouter = server.createApp();

RedactRouter.post("/redact", async (c: any) => {
    try {
        const body = await c.req.json();
        const inquiry = body.inquiry || "";
        const secrets = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/secrets.jsonnet"))
        );

        jsonnet.extString("inquiry", inquiry);
        jsonnet.extString("aws_access_key_id", secrets.aws_access_key_id);
        jsonnet.extString("aws_secret_access_key", secrets.aws_secret_access_key);
        jsonnet.extString("aws_region", secrets.aws_region || "us-east-1");
        jsonnet.extString("openai_api_key", secrets.openai_api_key);

        jsonnet.javascriptCallback("redactPrompt", redactPrompt);
        jsonnet.javascriptCallback("openAIChatWithRedaction", openAIChatWithRedaction);

        const response = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet"))
        );
        return c.json(response);
    } catch (error: any) {
        return c.json(
            {
                error: error?.message || "Failed to redact and process prompt",
            },
            500
        );
    }
});

import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { Palm2Endpoint } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.post("/palm2", async (c: any) => {
    try {
        const { question } = await c.req.json();
        const secrets = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
        );
        const apiKey = process.env.PALM2_API_KEY || secrets.palm2_api_key;

        jsonnet.extString("palm2_api_key", apiKey);
        jsonnet.extString("question", question || "");
        jsonnet.javascriptCallback(
            "palm2Call",
            async ({ prompt, palm2ApiKey }: { prompt: string; palm2ApiKey: string }) => {
                const palm2 = new Palm2Endpoint({ apiKey: palm2ApiKey });
                const res = await palm2.chat({ prompt });
                return JSON.stringify(res);
            }
        );

        const response = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
        return c.json(JSON.parse(response));
    } catch (error: any) {
        return c.json({ error: error?.message || String(error) }, 500);
    }
});

server.listen(3000);

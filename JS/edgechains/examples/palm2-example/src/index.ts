import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { Palm2Endpoint } from "@arakoodev/edgechains.js";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import fileURLToPath from "file-uri-to-path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.get("/", async (c: any) => {
    const topic = c.req.query("topic") || "machine learning";
    const secrets = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../src/jsonnet/prompts.jsonnet"))
    );
    const palm2 = new Palm2Endpoint({ apiKey: secrets.palm2_api_key });
    jsonnet.extString("topic", topic);
    const prompt = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../src/jsonnet/prompts.jsonnet"))
    ).summarize;
    const response = await palm2.gptFn(prompt);
    return c.json({ response });
});

server.listen(3000);

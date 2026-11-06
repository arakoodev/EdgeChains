import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { Palm2Endpoint } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import fileURLToPath from "file-uri-to-path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.get("/", async (c: any) => {
    const topic = c.req.query("topic") || "machine learning";
    jsonnet.extString("topic", topic);
    jsonnet.extString("palm2_api_key", process.env.PALM2_API_KEY || "");
    const config = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../src/jsonnet/prompts.jsonnet"))
    );
    const palm2 = new Palm2Endpoint({ apiKey: config.palm2_api_key });
    const response = await palm2.gptFn(config.summarize);
    return c.json({ response });
});

server.listen(3000);

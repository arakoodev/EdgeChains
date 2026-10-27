import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { Palm2AI } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import fileURLToPath from "file-uri-to-path";

const server = new ArakooServer();
const app = server.createApp();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.post("/palm2", async (c: any) => {
    const { question } = await c.req.json();
    const apiKey = process.env.PALM_API_KEY || "";

    jsonnet.extString("palm_api_key", apiKey);
    jsonnet.extString("question", question || "");
    jsonnet.javascriptCallback("palm2Call", async (args: any) => {
        const palm = new Palm2AI({ apiKey: args.apiKey });
        const res = await palm.generateText({ prompt: args.prompt });
        return JSON.stringify(res);
    });

    const evaluated = jsonnet.evaluateFile(
        path.join(__dirname, "../jsonnet/main.jsonnet")
    );
    return c.json(JSON.parse(evaluated));
});

server.listen(3000);

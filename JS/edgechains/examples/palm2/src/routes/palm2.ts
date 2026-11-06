import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";
//@ts-ignore
import createClient from "@arakoodev/edgechains.js/sync-rpc";

const server = new ArakooServer();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const palm2Call = createClient(path.join(__dirname, "../lib/generateResponse.cjs"));

export const Palm2Router = server.createApp();

Palm2Router.get("/", async (c: any) => {
    try {
        const question = c.req.query("question");
        const key = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/secrets.jsonnet"))).palm_api_key;
        jsonnet.extString("question", question || "");
        jsonnet.extString("palm_key", key);
        jsonnet.extString("palm_api_key", key);
        jsonnet.javascriptCallback("palm2Call", palm2Call);
        const response = jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet"));
        return c.json(response);
    } catch (error) {
        return c.json({ response: "An error occurred while generating the PaLM 2 answer. Please try again!" });
    }
});

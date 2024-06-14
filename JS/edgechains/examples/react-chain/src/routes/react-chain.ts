import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";
//@ts-ignore
import createClient from "@arakoodev/edgechains.js/sync-rpc";

const server = new ArakooServer();
const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const openAICall = createClient(path.join(__dirname, "../lib/generateResponse.cjs"));
const apiCall = createClient(path.join(__dirname, "../lib/apiCall.cjs"));

export const ReactChainRouter = server.createApp();

ReactChainRouter.get("/", async (c: any) => {
    try {
        const question = c.req.query("question");
        let key = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, '../../jsonnet/secrets.jsonnet'))).openai_api_key;
        jsonnet.extString("question", question || "");
        jsonnet.extString("openai_key", key);
        jsonnet.javascriptCallback("openAICall", openAICall);
        jsonnet.javascriptCallback("apiCall", apiCall);
        let response = jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet"));
        return c.json(response);
    } catch (error) {
        return c.json({
            response: "Any error occured while finding the answer. Please try again!",
        });
    }
});

import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path"
import path from "path";
//@ts-ignore
import createClient from "sync-rpc";

const server = new ArakooServer();
const jsonnet = new Jsonnet();
const __dirname = fileURLToPath(import.meta.url);

const openAICall = createClient(path.join(__dirname, "../../lib/generateResponse.cjs"));
const apiCall = createClient(path.join(__dirname, "../../lib/apiCall.cjs"));

export const ReactChainRouter = server.createApp();

ReactChainRouter.get("/", async (c: any) => {
    try {
        const question = c.req.query("question");

        jsonnet.extString("question", question || "");
        jsonnet.javascriptCallback("openAICall", openAICall);
        jsonnet.javascriptCallback("apiCall", apiCall);
        let response = jsonnet.evaluateFile(path.join(__dirname, "../../../jsonnet/main.jsonnet"));
        return c.json(response);
    } catch (error) {
        return c.json({
            response: "Any error occured while finding the answer. Please try again!",
        });
    }
});

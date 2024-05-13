
import { ArakooServer } from "arakoodev/arakooserver";
//@ts-ignore
import Jsonnet from "@arakoodev/jsonnet";
import { fileURLToPath } from "url"
import path from "path";
//@ts-ignore
import createClient from 'sync-rpc';

const server = new ArakooServer();
const jsonnet = new Jsonnet();
const __dirname = fileURLToPath(import.meta.url);

const getExtractedSummary = createClient(path.join(__dirname, "../../lib/getExtractedSummary.cjs"));
const callWikipediaApi = createClient(path.join(__dirname, "../../lib/callWikipediaApi.cjs"));
const openAICall = createClient(path.join(__dirname, "../../lib/generateResponse.cjs"));

export const ReactChainRouter = server.createApp();

ReactChainRouter.get("/", async (c:any) => {
    try {
        const question = c.req.query("question");

        jsonnet.extString("question", question || "");
        jsonnet.javascriptCallback("getExtractedSummary", getExtractedSummary);
        jsonnet.javascriptCallback("openAICall", openAICall);
        let response =jsonnet.javascriptCallback("callWikipediaApi", callWikipediaApi).evaluateFile(path.join(__dirname, "../../../jsonnet/react-chain.jsonnet"))
        return c.json(response)

    } catch (error) {
        return c.json({ response: "Any error occured while finding the answer. Please try again!" })
    }
})


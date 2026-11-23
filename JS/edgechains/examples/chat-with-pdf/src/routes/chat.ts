import path from "path";
//@ts-ignore
import createClient from "sync-rpc";
import fileURLToPath from "file-uri-to-path";
import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { InsertToSupabase, splitedDocs } from "../lib/InsertToSupabase.js";

import Jsonnet from "@arakoodev/jsonnet";

const server = new ArakooServer();
const __dirname = fileURLToPath(import.meta.url);

const jsonnet = new Jsonnet();

const openAICall = createClient(path.join(__dirname, "../../lib/generateResponse.cjs"));
const getQueryMatch = createClient(path.join(__dirname, "../../lib/getQueryMatch.cjs"));
const getEmbeddings = createClient(path.join(__dirname, "../../lib/getEmbeddings.cjs"));

// this should run only once for uploding pdf data to supabase then you can continue with the chatbot functionality
await InsertToSupabase(splitedDocs);

export const ChatRouter: any = server.createApp();

ChatRouter.get("/", async (c: any) => {
    console.time("ExecutionTime");
    const searchStr = c.req.query("question").toLowerCase();
    jsonnet.extString("query", searchStr);
    jsonnet.javascriptCallback("getEmbeddings", getEmbeddings);
    jsonnet.javascriptCallback("getQueryMatch", getQueryMatch);
    jsonnet.javascriptCallback("openAICall", openAICall);
    const response = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../../../jsonnet/main.jsonnet"))
    );
    console.timeEnd("ExecutionTime");
    return c.json(response);
});

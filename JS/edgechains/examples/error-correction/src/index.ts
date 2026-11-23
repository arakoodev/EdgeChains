import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import Jsonnet from "@arakoodev/jsonnet";

import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";

import fileURLToPath from "file-uri-to-path";
import path from "path";
const server = new ArakooServer();

const app = server.createApp();

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Native that runs the generate -> verify -> correct loop (arxiv 2311.08516).
const errorCorrection = createSyncRPC(
    path.join(__dirname, "./lib/errorCorrection.cjs")
);

app.post("/error-correction", async (c: any) => {
    try {
        const { problem, candidateAnswer } = await c.req.json();
        const key = JSON.parse(
            jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
        ).openai_api_key;
        jsonnet.extString("openai_api_key", key);
        jsonnet.extString("problem", problem || "");
        jsonnet.extString("candidate_answer", candidateAnswer || "");
        jsonnet.javascriptCallback("errorCorrection", errorCorrection);
        let response = jsonnet.evaluateFile(
            path.join(__dirname, "../jsonnet/main.jsonnet")
        );
        return c.json(JSON.parse(response));
    } catch (error) {
        // Return a structured JSON error instead of falling through to Hono's
        // default 404 (which happens when a handler returns undefined).
        console.log("error occured", error);
        return c.json({ error: String(error) }, 500);
    }
});

server.listen(3000);
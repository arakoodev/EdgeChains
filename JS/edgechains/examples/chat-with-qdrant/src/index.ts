import path from "path";
import { fileURLToPath } from "url";
import Jsonnet from "@arakoodev/jsonnet";
import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";
import { insertSampleDocs } from "./lib/InsertToQdrant.js";
import { qdrantSearchAdaEmbedding } from "./service/QdrantSearchService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnet = new Jsonnet();
const secrets = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/secrets.jsonnet"))
);

const qdrantUrl = process.env.QDRANT_URL || secrets.qdrant_url;
const qdrantApiKey = process.env.QDRANT_API_KEY || secrets.qdrant_api_key || "";

const server = new ArakooServer();
const app = server.createApp();

try {
    const qdrant = new Qdrant(qdrantUrl, qdrantApiKey);
    await insertSampleDocs(qdrant);
    console.log(`Seeded Qdrant collection at ${qdrantUrl}`);
} catch (error) {
    console.error(
        "Could not reach Qdrant. Start it with:\n  docker run -p 6333:6333 qdrant/qdrant\n" +
            "Or set QDRANT_URL / QDRANT_API_KEY (constructor args and secrets.jsonnet also work).",
        error
    );
}

app.get("/chatWithQdrant", async (c: any) => {
    const question = (c.req.query("question") || "").toString();
    if (!question) {
        return c.json({ error: "Pass ?question=..." }, 400);
    }
    const response = await qdrantSearchAdaEmbedding(
        { query: question, topK: 3 },
        qdrantUrl,
        qdrantApiKey
    );
    return c.json(response);
});

app.get("/health", async (c: any) => {
    try {
        const qdrant = new Qdrant(qdrantUrl, qdrantApiKey);
        const collections = await qdrant.listCollections();
        return c.json({ ok: true, qdrantUrl, collections });
    } catch (error: any) {
        return c.json({ ok: false, qdrantUrl, error: error.message }, 503);
    }
});

server.listen(3000);

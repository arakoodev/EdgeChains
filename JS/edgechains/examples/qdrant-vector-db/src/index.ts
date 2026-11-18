import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const calls: Array<{ url: string; init: unknown }> = [];
const fetch = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    calls.push({ url, init });
    return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "",
        json: async () => ({ result: [], status: "ok" }),
    };
};

async function run() {
    const qdrant = new Qdrant("http://localhost:6333", "demo-key", fetch);
    const client = qdrant.createClient();

    await qdrant.createCollection({
        client,
        collectionName: "documents",
        vectorSize: 3,
    });
    await qdrant.insertVectorData({
        client,
        tableName: "documents",
        id: "doc-1",
        content: "hello qdrant",
        embedding: [0.1, 0.2, 0.3],
    });
    await qdrant.getDataFromQuery({
        client,
        tableName: "documents",
        query_embedding: [0.1, 0.2, 0.3],
        match_count: 1,
    });

    console.log(JSON.stringify(calls, null, 2));
}

run().catch((error) => {
    console.error(error);
});

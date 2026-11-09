import assert from "node:assert";
import { Qdrant } from "./index.js";

async function runTests() {
  const requests = [];
  const mockTransport = async (url, options) => {
    requests.push({ url, method: options.method, body: JSON.parse(options.body) });
    if (url.endsWith("/points/search")) {
      return {
        status: "ok",
        result: [{ id: 1, score: 0.99, payload: { text: "EdgeChains Qdrant doc" } }],
      };
    }
    if (url.endsWith("/points")) {
      return {
        status: "ok",
        result: [{ id: 1, payload: { text: "EdgeChains Qdrant doc" } }],
      };
    }
    return { status: "ok", result: { operation_id: 1, status: "completed" } };
  };

  const qdrant = new Qdrant("https://qdrant.example.io", "secret-key", mockTransport);

  await qdrant.createCollection({ collectionName: "docs", vectorSize: 3 });
  assert.strictEqual(requests[0].method, "PUT");
  assert.strictEqual(requests[0].body.vectors.size, 3);

  await qdrant.insertVectorData({
    collectionName: "docs",
    points: [{ id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "EdgeChains Qdrant doc" } }],
  });
  assert.ok(requests[1].url.includes("/collections/docs/points?wait=true"));

  const hits = await qdrant.getDataFromQuery({
    collectionName: "docs",
    vector: [0.1, 0.2, 0.3],
    limit: 3,
  });
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].payload.text, "EdgeChains Qdrant doc");

  const byId = await qdrant.getDataById({ collectionName: "docs", ids: [1] });
  assert.strictEqual(byId[0].id, 1);

  await qdrant.deleteById({ collectionName: "docs", ids: [1] });
  assert.ok(requests[4].url.includes("/points/delete?wait=true"));

  console.log("ALL QDRANT VECTOR DB TESTS PASSED");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

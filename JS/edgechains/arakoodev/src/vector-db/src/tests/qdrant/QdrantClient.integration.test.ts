import { expect, it } from "vitest";
import { QdrantClient } from "../../lib/qdrant/QdrantClient.js";

it.skipIf(!process.env.QDRANT_URL)(
  "creates, inserts, queries, and deletes with a live Qdrant server",
  async () => {
    const client = new QdrantClient({
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY,
    });
    const collection = `edgechains_test_${Date.now()}`;
    await client.createCollection(collection, { size: 3, distance: "Cosine" });
    try {
      await client.upsert(collection, [
        {
          id: 1,
          vector: [1, 0, 0],
          payload: { namespace: "docs", text: "first" },
        },
        {
          id: 2,
          vector: [0, 1, 0],
          payload: { namespace: "docs", text: "second" },
        },
        {
          id: 3,
          vector: [1, 0, 0],
          payload: { namespace: "other", text: "excluded" },
        },
      ]);
      const query = {
        query: [1, 0, 0],
        limit: 2,
        filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
      };
      const results = await client.query(collection, query);
      expect(results.map((point) => point.id)).toEqual([1, 2]);
      expect(results[0].payload?.text).toBe("first");
      expect(results[0].score).toBeCloseTo(1);
      await client.deletePoints(collection, [1]);
      expect(
        (await client.query(collection, query)).map((point) => point.id),
      ).toEqual([2]);
    } finally {
      await client.deleteCollection(collection);
    }
  },
  30_000,
);

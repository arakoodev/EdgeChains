import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

it.skipIf(!process.env.QDRANT_URL)(
  "queries a named vector and respects omitted payloads",
  async () => {
    const q = new Qdrant({
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY,
    });
    const collection = `edgechains_named_${randomUUID()}`;
    await q.createCollection(collection, {
      text: { size: 2, distance: "Dot" },
    });
    try {
      await q.upsert(collection, [
        { id: 1, vector: { text: [1, 0] }, payload: { text: "first" } },
        { id: 2, vector: { text: [0, 1] }, payload: { text: "second" } },
      ]);
      const results = await q.search(collection, [1, 0], {
        using: "text",
        score_threshold: 0.5,
        with_payload: false,
        with_vector: true,
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(1);
      expect(results[0].payload == null).toBe(true);
      expect(results[0].vector).toEqual({ text: [1, 0] });
      expect(
        (
          await q.search(collection, [1, 0], {
            using: "text",
            offset: 1,
            limit: 1,
          })
        )[0].id,
      ).toBe(2);
    } finally {
      await q.deleteCollection(collection);
    }
  },
  30000,
);

// Explicit opt-in; creates and removes only a uniquely named test collection.
it.skipIf(!process.env.QDRANT_URL)(
  "runs the complete CRUD and filtered search flow against Qdrant",
  async () => {
    const q = new Qdrant({
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY,
    });
    const collection = `edgechains_test_${randomUUID()}`;
    const uuid = randomUUID();
    await q.createCollection(collection, { size: 3, distance: "Cosine" });
    try {
      expect((await q.listCollections()).collections).toContainEqual({
        name: collection,
      });
      await q.upsert(collection, [
        {
          id: 0,
          vector: [1, 0, 0],
          payload: { text: "雪 🦊", namespace: "a" },
        },
        {
          id: uuid,
          vector: [0, 1, 0],
          payload: { text: "second", namespace: "b" },
        },
      ]);
      expect((await q.search(collection, [1, 0, 0], { limit: 1 }))[0].id).toBe(
        0,
      );
      const filtered = await q.search(collection, [1, 0, 0], {
        filter: { must: [{ key: "namespace", match: { value: "b" } }] },
      });
      expect(filtered.map((point) => point.id)).toEqual([uuid]);
      expect((await q.retrieve(collection, [0]))[0].payload?.text).toBe(
        "雪 🦊",
      );
      await q.setPayload(collection, [0], { text: "updated" });
      expect((await q.retrieve(collection, [0]))[0].payload).toEqual({
        text: "updated",
        namespace: "a",
      });
      await q.upsert(collection, [
        { id: 0, vector: [0, 0, 1], payload: { text: "replaced" } },
      ]);
      expect(
        (await q.search(collection, [0, 0, 1], { limit: 1 }))[0].payload?.text,
      ).toBe("replaced");
      await q.deletePoints(collection, [0, uuid]);
      expect(await q.retrieve(collection, [0, uuid])).toEqual([]);
      expect(await q.search(collection, [1, 0, 0])).toEqual([]);
      await expect(
        q.upsert(collection, [{ id: 1, vector: [1, 2] }]),
      ).rejects.toThrow("HTTP 400");
    } finally {
      await q.deleteCollection(collection);
    }
    await expect(q.retrieve(collection, [0])).rejects.toThrow("HTTP 404");
  },
  30000,
);

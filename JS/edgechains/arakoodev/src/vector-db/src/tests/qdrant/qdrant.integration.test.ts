import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

// Opt-in only. Creates and deletes its own uniquely named test collection.
const url = process.env.QDRANT_URL;
describe.skipIf(!url)("Qdrant live server", () => {
    const client = new Qdrant(url || "http://127.0.0.1:6333", process.env.QDRANT_API_KEY);
    const collection = `edgechains-test-${randomUUID()}`;
    let created = false;

    beforeAll(async () => {
        created = await client.createCollection(collection, 3);
    });
    afterAll(async () => {
        if (created) await client.deleteCollection(collection);
    });

    it("round-trips points, filters ranked results, and deletes points", async () => {
        expect(created).toBe(true);
        const uuid = randomUUID();
        const operation = await client.upsertPoints(collection, [
            { id: 1, vector: [1, 0, 0], payload: { namespace: "docs", text: "first" } },
            { id: uuid, vector: [0, 1, 0], payload: { namespace: "other" } },
        ]);
        expect(operation.status).toBe("completed");
        const matches = await client.search(collection, [1, 0, 0], {
            filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
            limit: 2,
        });
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(1);
        expect(matches[0].score).toBeCloseTo(1);
        expect(matches[0].payload?.text).toBe("first");
        const records = await client.retrievePoints(collection, [1, uuid, 999]);
        expect(records.map((record) => record.id)).toEqual(expect.arrayContaining([1, uuid]));
        expect(records).toHaveLength(2);
        expect((await client.deletePoints(collection, [1, uuid])).status).toBe("completed");
        expect(await client.search(collection, [1, 0, 0])).toEqual([]);
        expect(await client.retrievePoints(collection, [1, uuid])).toEqual([]);
    });
});

import { afterAll, describe, expect, it } from "vitest";
import { Qdrant, QdrantError } from "../../index.js";
import { randomUUID } from "node:crypto";

// Explicit opt-in: never infer a production endpoint or create a default connection.
const url = process.env.EDGECHAINS_QDRANT_TEST_URL;
const enabled = !!url && process.env.EDGECHAINS_QDRANT_ALLOW_TEST_WRITES === "1";
describe.skipIf(!enabled)("Qdrant real REST integration", () => {
    const collections: string[] = [];
    const q = enabled
        ? new Qdrant({ url: url!, apiKey: process.env.EDGECHAINS_QDRANT_TEST_API_KEY })
        : undefined;
    const name = () => {
        const n = `edgechains_test_${randomUUID().replaceAll("-", "")}`;
        return n;
    };
    afterAll(async () => {
        for (const n of collections) {
            try {
                await q!.deleteCollection(n);
            } catch (error) {
                if (!(error instanceof QdrantError && error.status === 404)) throw error;
            }
        }
    });

    it("creates, upserts, filters, paginates, updates, retrieves and deletes real vectors", async () => {
        const n = name();
        expect(await q!.createCollection(n, { size: 3, distance: "Cosine" })).toBe(true);
        collections.push(n);
        expect(await q!.getCollection(n)).toHaveProperty("status");
        await q!.upsertPoints(n, [
            { id: 1, vector: [1, 0, 0], payload: { text: "alpha", kind: "guide" } },
            { id: 2, vector: [0, 1, 0], payload: { text: "beta", kind: "guide" } },
            { id: 3, vector: [0, 0, 1], payload: { text: "gamma", kind: "note" } },
        ]);
        const best = await q!.query(n, { vector: [1, 0, 0], limit: 1 });
        expect(best[0].id).toBe(1);
        expect(best[0].score).toBeCloseTo(1);
        expect(best[0].payload?.text).toBe("alpha");
        const filtered = await q!.query(n, {
            vector: [1, 0, 0],
            filter: { must: [{ key: "kind", match: { value: "note" } }] },
        });
        expect(filtered.map((p) => p.id)).toEqual([3]);
        const first = await q!.scroll(n, { limit: 2 });
        expect(first.points.map((p) => p.id)).toEqual([1, 2]);
        expect(first.nextPageOffset).toBe(3);
        const last = await q!.scroll(n, { limit: 2, offset: first.nextPageOffset! });
        expect(last.points.map((p) => p.id)).toEqual([3]);
        expect(last.nextPageOffset).toBeNull();
        await q!.setPayload(n, [1], { text: "edited" });
        const read = await q!.retrievePoints(n, [1], true);
        expect(read[0].payload).toMatchObject({ text: "edited", kind: "guide" });
        expect(read[0].vector).toEqual([1, 0, 0]);
        await q!.upsertPoints(n, [{ id: 1, vector: [0, 1, 0], payload: { text: "replacement" } }]);
        expect((await q!.retrievePoints(n, [1], true))[0].vector).toEqual([0, 1, 0]);
        await q!.deletePoints(n, [1]);
        expect(await q!.retrievePoints(n, [1])).toEqual([]);
        expect(
            (
                await q!.scroll(n, {
                    filter: { must: [{ key: "kind", match: { value: "missing" } }] },
                })
            ).points
        ).toEqual([]);
    });
    it("supports named dense vectors and UUID IDs", async () => {
        const n = name();
        const id = randomUUID();
        await q!.createCollection(n, {
            text: { size: 2, distance: "Dot" },
            image: { size: 2, distance: "Euclid" },
        });
        collections.push(n);
        await q!.upsertPoints(n, [
            { id, vector: { text: [2, 0], image: [0, 2] }, payload: { source: "fixture" } },
        ]);
        const hits = await q!.query(n, { vector: [1, 0], using: "text" });
        expect(hits[0].id).toBe(id);
        expect(hits[0].score).toBeCloseTo(2);
    });
    it("reports real auth failure, missing collections, dimension mismatch and duplicate create", async () => {
        const n = name();
        await q!.createCollection(n, { size: 2, distance: "Cosine" });
        collections.push(n);
        await expect(q!.createCollection(n, { size: 2, distance: "Cosine" })).rejects.toMatchObject(
            { name: "QdrantError", status: 409 }
        );
        await expect(q!.upsertPoints(n, [{ id: 1, vector: [1, 2, 3] }])).rejects.toMatchObject({
            name: "QdrantError",
            status: 400,
        });
        expect((await q!.scroll(n)).points).toEqual([]);
        await expect(q!.getCollection(n + "_absent")).rejects.toMatchObject({ status: 404 });
        if (process.env.EDGECHAINS_QDRANT_TEST_API_KEY) {
            const bad = new Qdrant({ url: url!, apiKey: "definitely-not-the-local-test-key" });
            await expect(bad.getCollection(n)).rejects.toBeInstanceOf(QdrantError);
        }
        expect(await q!.deleteCollection(n)).toBe(true);
        await expect(q!.getCollection(n)).rejects.toMatchObject({ status: 404 });
    });
});

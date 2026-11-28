// Run after npm run build. Uses the actual package export, not the source file.
const { Qdrant } = require("@arakoodev/edgechains.js/vector-db");
const { randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
    if (!process.env.QDRANT_URL) throw new Error("Set QDRANT_URL to a test Qdrant server");
    const q = new Qdrant({ url: process.env.QDRANT_URL, apiKey: process.env.QDRANT_API_KEY });
    const collection = `edgechains_demo_${randomUUID().replaceAll("-", "")}`;
    const delay = Math.min(2000, Math.max(0, Number(process.env.DEMO_DELAY_MS) || 0));
    const step = async (label, result) => {
        console.log(`${new Date().toISOString()} ${label}\n${JSON.stringify(result)}\n`);
        await sleep(delay);
    };
    let created = false;
    try {
        created = await q.createCollection(collection, { size: 3, distance: "Cosine" });
        assert.equal(created, true);
        await step("1. CREATE a new temporary collection", created);
        await q.upsertPoints(collection, [
            { id: 1, vector: [1, 0, 0], payload: { text: "First guide", kind: "guide" } },
            { id: 2, vector: [0, 1, 0], payload: { text: "Second guide", kind: "guide" } },
            { id: 3, vector: [0, 0, 1], payload: { text: "A note", kind: "note" } },
        ]);
        await step("2. UPSERT three hand-specified vectors", { count: 3 });
        const nearest = await q.query(collection, { vector: [1, 0, 0], limit: 1 });
        assert.equal(nearest[0].id, 1);
        await step("3. QUERY nearest vector", nearest);
        const filtered = await q.query(collection, {
            vector: [1, 0, 0],
            filter: { must: [{ key: "kind", match: { value: "note" } }] },
        });
        assert.deepEqual(
            filtered.map((p) => p.id),
            [3]
        );
        await step("4. FILTER by payload, not similarity alone", filtered);
        const page1 = await q.scroll(collection, { limit: 2 });
        const page2 = await q.scroll(collection, { limit: 2, offset: page1.nextPageOffset });
        assert.deepEqual(
            [...page1.points, ...page2.points].map((p) => p.id),
            [1, 2, 3]
        );
        await step("5. SCROLL two pages, preserve the continuation", {
            first: page1.points.map((p) => p.id),
            nextOffset: page1.nextPageOffset,
            second: page2.points.map((p) => p.id),
            finalOffset: page2.nextPageOffset,
        });
        await q.setPayload(collection, [1], { text: "Updated guide" });
        const updated = await q.retrievePoints(collection, [1]);
        assert.equal(updated[0].payload.text, "Updated guide");
        await step("6. UPDATE and retrieve stored payload", updated);
        await q.deletePoints(collection, [1]);
        assert.deepEqual(await q.retrievePoints(collection, [1]), []);
        await step("7. DELETE selected point and verify absence", {
            remainingIds: (await q.scroll(collection)).points.map((p) => p.id),
        });
    } finally {
        // Delete only the randomly named collection this invocation created.
        if (created)
            await step(
                "8. CLEAN UP this example's collection",
                await q.deleteCollection(collection)
            );
    }
}
main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});

import assert from "node:assert/strict";
import { Qdrant } from "../dist/vector-db/src/lib/qdrant/qdrant.js";

const url = process.env.QDRANT_URL ?? "http://127.0.0.1:16333";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("This synthetic-data demo only runs against localhost");
}
const db = new Qdrant({ url });
const collectionName = `edgechains_demo_${Date.now()}`;
let created = false;
try {
  await db.createCollection({ collectionName, size: 3 });
  created = true;
  console.log("Created isolated three-dimensional collection");
  await db.insertVectorData({
    collectionName,
    points: [
      {
        id: 1,
        vector: [1, 0, 0],
        payload: { content: "first note", kind: "note" },
      },
      {
        id: 2,
        vector: [0, 1, 0],
        payload: { content: "second note", kind: "note" },
      },
      {
        id: 3,
        vector: [0, 0, 1],
        payload: { content: "third document", kind: "document" },
      },
    ],
  });
  console.log("Inserted three synthetic points");
  const nearest = await db.getDataFromQuery({
    collectionName,
    vector: [1, 0, 0],
    limit: 1,
    filter: { must: [{ key: "kind", match: { value: "note" } }] },
  });
  assert.equal(nearest[0].id, 1);
  assert.equal(nearest[0].payload.content, "first note");
  console.log(
    `Filtered vector search: nearest id=${nearest[0].id}, score=${nearest[0].score}`,
  );
  const ids = [];
  let offset;
  do {
    const page = await db.getData({ collectionName, limit: 1, offset });
    ids.push(...page.points.map((point) => point.id));
    offset = page.next_page_offset ?? undefined;
  } while (offset !== undefined);
  assert.deepEqual(ids, [1, 2, 3]);
  console.log(`One-point scroll pages returned every ID: ${ids.join(", ")}`);
  await db.updateById({
    collectionName,
    id: 1,
    updatedContent: { content: "corrected note" },
  });
  const updated = await db.getDataById({ collectionName, id: 1 });
  assert.deepEqual(updated.vector, [1, 0, 0]);
  assert.equal(updated.payload.kind, "note");
  assert.equal(updated.payload.content, "corrected note");
  console.log("Payload update preserved the vector and untouched kind field");
  await db.deleteById({ collectionName, id: 1 });
  assert.equal(await db.getDataById({ collectionName, id: 1 }), null);
  console.log("Deleted point 1; retrieval returned null");
  console.log(
    "PASS: live local Qdrant create/upsert/query/scroll/retrieve/update/delete",
  );
} finally {
  if (created) {
    const response = await fetch(
      `${url.replace(/\/+$/, "")}/collections/${collectionName}`,
      { method: "DELETE" },
    );
    if (!response.ok)
      throw new Error(`Demo cleanup failed: HTTP ${response.status}`);
    console.log("Removed the isolated demo collection");
  }
}

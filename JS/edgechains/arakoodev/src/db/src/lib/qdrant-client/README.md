# QdrantClient

A dependency-free client for the [Qdrant](https://qdrant.tech/documentation/) vector
database, part of the EdgeChains JS SDK (`@arakoodev/edgechains.js/db`).

Unlike the existing `PostgresClient` (which uses TypeORM/Postgres), `QdrantClient`
talks to the Qdrant **REST API directly over `fetch`** — no Qdrant npm packages are
required. This keeps the SDK lightweight and portable to edge runtimes.

## Install

```ts
import { QdrantClient, QdrantDistanceMetric } from "@arakoodev/edgechains.js/db";
```

## Configuration

| Option           | Type     | Default                     | Description                                            |
| ---------------- | -------- | --------------------------- | ------------------------------------------------------ |
| `url`            | string   | `QDRANT_URL` / `http://localhost:6333` | Base URL of the Qdrant server.             |
| `apiKey`         | string   | `QDRANT_API_KEY`            | API key for Qdrant Cloud / secured deployments.        |
| `collectionName` | string   | —                           | Default collection used by `dbQuery()`.                |
| `fetchImpl`      | function | global `fetch`              | Custom fetch implementation (edge runtimes / testing). |

## Usage

```ts
const client = new QdrantClient({
  url: "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

// 1. Create a collection
await client.createCollection({
  collectionName: "docs",
  vectorSize: 1536,
  distance: QdrantDistanceMetric.COSINE,
});

// 2. Upsert points (vectors + payload)
await client.upsert({
  collectionName: "docs",
  points: [{ id: 1, vector: [...embedding], payload: { raw_text: "hello" } }],
});

// 3. Query — mirrors PostgresClient.dbQuery()
const hits = await client.dbQuery([[...queryEmbedding]], "docs", 5);
```

## API

- `createCollection({ collectionName, vectorSize, distance?, hnswConfig? })`
- `getCollection(collectionName)` / `deleteCollection(collectionName)`
- `upsert({ collectionName, points, wait? })`
- `delete({ collectionName, ids, wait? })`
- `scroll({ collectionName, limit?, offset?, withPayload?, withVector? })`
- `search({ collectionName, vector, topK?, filter?, withPayload?, withVector?, scoreThreshold? })`
- `searchPoints(...)` — returns just the hits array
- `dbQuery(wordEmbeddings, collectionName?, topK?, filter?)` — one entrypoint that
  searches for each embedding, de-duplicates by point id (highest score wins), and
  returns results sorted by score descending.

## Testing

```bash
cd JS/edgechains/arakoodev
npm install
npx tsc -b
npx jest src/db/src/tests/qdrant-client/qdrantClient.test.ts
```
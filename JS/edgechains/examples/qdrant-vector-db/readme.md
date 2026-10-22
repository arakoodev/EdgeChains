# Qdrant vector database example

This example shows how to use the EdgeChains Qdrant vector database client.

## Prerequisites

Run Qdrant locally:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

Or point `QDRANT_URL` to a hosted Qdrant instance.

## Setup

```bash
cd JS/edgechains/examples/qdrant-vector-db
npm install
cp .env.example .env
npm run start
```

The example:

1. Creates a `documents` collection.
2. Upserts two vector points with payloads.
3. Searches for the nearest vectors.
4. Deletes the inserted points.

For Qdrant Cloud, set `QDRANT_API_KEY` in `.env`.

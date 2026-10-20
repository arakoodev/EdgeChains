# Qdrant hybrid search example

Demonstrates `QdrantClient` from `@arakoodev/edgechains.js/db`: hybrid
retrieval over a Qdrant collection combining vector similarity, full-text
match and document date with weighted reciprocal rank fusion - the same
contract `PostgresClient` implements over Postgres/pgvector.

## Run

1. Start Qdrant: `docker run -p 6333:6333 qdrant/qdrant`
   (or create a free Qdrant Cloud cluster and put its URL/key in `.env`)
2. `npm install`
3. `cp .env.example .env`
4. `npm start`

Expected output: three seeded documents ranked by fused RRF score.

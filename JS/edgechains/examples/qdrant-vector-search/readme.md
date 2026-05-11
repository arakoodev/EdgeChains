# Qdrant Vector Search

This example demonstrates using EdgeChains' Qdrant vector database client.

The client talks to Qdrant through the REST API directly. It does not require a
Qdrant npm package.

## Run

Start Qdrant locally:

```sh
docker run -p 6333:6333 qdrant/qdrant
```

Then run:

```sh
export QDRANT_URL=http://localhost:6333
export QDRANT_API_KEY=
export QDRANT_COLLECTION=edgechains_qdrant_example
bun install
bun run start
```

The example creates a collection, upserts two points, and searches for the
closest matches with a payload filter.

# Chat with Qdrant

Small EdgeChains example that stores sample documents in [Qdrant](https://qdrant.tech/documentation/)
and answers questions with **jsonnet-owned prompts** (same pattern as HydeSearchService).

The SDK client talks to the Qdrant **HTTP API** with `axios`. It does **not** depend on
`@qdrant/js-client-rest` or any other official Qdrant package.

## Setup

1. Start Qdrant (API key is optional for local):

    ```bash
    docker run -p 6333:6333 qdrant/qdrant
    ```

2. Install this example (it uses the local SDK via `file:../../arakoodev`):

    ```bash
    cd JS/edgechains/arakoodev && npm install && npm run build
    cd ../examples/chat-with-qdrant && npm install
    ```

3. Configure URL / API key (any of these work; constructor args win, then env, then jsonnet):

    | Source | Keys |
    | --- | --- |
    | Environment | `QDRANT_URL`, `QDRANT_API_KEY` |
    | `jsonnet/secrets.jsonnet` | `qdrant_url`, `qdrant_api_key`, `openai_api_key` |
    | Constructor | `new Qdrant(url, apiKey)` / `new QdrantClient(..., url, apiKey)` |

    Local default is `http://localhost:6333` with an empty API key.

    ```jsonnet
    local QDRANT_URL = "http://localhost:6333";
    local QDRANT_API_KEY = "";
    local OPENAI_API_KEY = "your openai api key here";
    {
      "qdrant_url": QDRANT_URL,
      "qdrant_api_key": QDRANT_API_KEY,
      "openai_api_key": OPENAI_API_KEY,
    }
    ```

    Qdrant Cloud: set `QDRANT_URL` to your cluster URL (for example
    `https://YOUR-CLUSTER.aws.cloud.qdrant.io:6333`) and `QDRANT_API_KEY` to the dashboard key.

## Usage

```bash
npm start
```

```bash
curl "http://localhost:3000/chatWithQdrant?question=How%20does%20EdgeChains%20store%20prompts"
curl "http://localhost:3000/health"
```

On startup the example creates a `documents` collection (32-d local embeddings so it runs
without OpenAI) and upserts three sample passages. Production apps should swap
`localEmbed` for OpenAI embeddings and create the collection with `vectorSize: 1536`.

Prompts live in:

- `jsonnet/prompts.jsonnet` — summary / system / user templates
- `jsonnet/hyde.jsonnet` — `{}` and `{time}` substitution (HydeSearch)

## SDK usage

```ts
import { Qdrant, QdrantClient, QdrantDistanceMetric } from "@arakoodev/edgechains.js/vector-db";
// QdrantClient is also exported from "@arakoodev/edgechains.js/db" (PostgresClient parity)

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);
await qdrant.createCollectionIfNotExists({
    collectionName: "documents",
    vectorSize: 1536,
    distance: QdrantDistanceMetric.COSINE, // or IP / L2 (PostgresClient names also work)
});
await qdrant.insertVectorData({
    tableName: "documents", // alias for collectionName
    content: "hello",
    embedding: new Array(1536).fill(0),
});
const hits = await qdrant.getDataFromQuery({
    collectionName: "documents",
    query_embedding: new Array(1536).fill(0),
    match_count: 3,
    similarity_threshold: 0.5,
});

const dbClient = new QdrantClient(
    [embedding],
    QdrantDistanceMetric.IP,
    5,
    20,
    "documents",
    "360_docs",
    arkRequest,
    15
);
const rows = await dbClient.dbQuery(); // raw_text, filename, score, rrf_score, ...
```

## Tests

```bash
npm test
```

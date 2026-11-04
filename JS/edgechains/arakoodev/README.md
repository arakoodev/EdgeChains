Installation

```
npm install arakoodev
```

## Qdrant vector database

The JS SDK wraps the Qdrant REST API directly (`axios`) — it does **not** depend on
`@qdrant/js-client-rest` or other official Qdrant packages.

```ts
import { Qdrant, QdrantClient, QdrantDistanceMetric } from "@arakoodev/edgechains.js/vector-db";
```

`QdrantClient` is also re-exported from `@arakoodev/edgechains.js/db` so it can replace
`PostgresClient` in HydeSearch-style flows.

Configuration (constructor arguments win, then env):

| Name             | Default                 | Purpose                                                  |
| ---------------- | ----------------------- | -------------------------------------------------------- |
| `QDRANT_URL`     | `http://localhost:6333` | REST base URL                                            |
| `QDRANT_API_KEY` | _(empty)_               | Sent as the `api-key` header (optional for local Qdrant) |

See `JS/edgechains/examples/chat-with-qdrant` for a jsonnet prompt example.

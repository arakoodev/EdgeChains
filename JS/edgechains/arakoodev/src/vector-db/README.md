# Qdrant

The vector database package includes a dependency-free Qdrant REST client.

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db"

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY)
const client = qdrant.createClient()

await qdrant.createCollection({
  client,
  collectionName: "documents",
  vectorSize: 3,
})

await qdrant.insertVectorData({
  client,
  collectionName: "documents",
  points: [{ id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "hello" } }],
})

const matches = await qdrant.getDataFromQuery({
  client,
  collectionName: "documents",
  vector: [0.1, 0.2, 0.3],
  limit: 5,
})
```

The wrapper also supports scrolling, point retrieval, payload updates, and
point deletion. Tests mock `fetch`, so no Qdrant account or server is needed.

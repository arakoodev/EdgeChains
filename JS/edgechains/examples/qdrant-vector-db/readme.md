# Qdrant vector database example

This example demonstrates the EdgeChains Qdrant REST wrapper without requiring a live Qdrant server.

Run the local dry run:

```bash
npm install
npm start
```

To call a real Qdrant instance, create `new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY)` without the mock `httpClient`.

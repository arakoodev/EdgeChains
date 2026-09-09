{
  qdrant: {
    url: std.extVar("QDRANT_URL"),
    apiKey: std.extVar("QDRANT_API_KEY"),
    collectionName: "edgechains_qdrant_example",
    vectorSize: 3,
  },
  documents: [
    {
      id: 1,
      vector: [0.1, 0.2, 0.3],
      payload: {
        content: "EdgeChains can query Qdrant using the REST API.",
        source: "docs",
      },
    },
    {
      id: 2,
      vector: [0.2, 0.1, 0.4],
      payload: {
        content: "Qdrant stores vectors and metadata payloads.",
        source: "docs",
      },
    },
  ],
  query: {
    vector: [0.1, 0.2, 0.3],
    limit: 2,
  },
}

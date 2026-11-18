{
    qdrantUrl: "http://localhost:6333",
    collectionName: "edgechains_documents",
    vectorSize: 4,
    distance: "Cosine",
    topK: 3,
    samplePoints: [
        {
            id: 1,
            vector: [0.12, 0.45, 0.78, 0.34],
            payload: {
                title: "EdgeChains Overview",
                text: "EdgeChains orchestrates prompts and vector databases using Jsonnet.",
            },
        },
        {
            id: 2,
            vector: [0.89, 0.21, 0.11, 0.67],
            payload: {
                title: "Qdrant Vector Search",
                text: "Qdrant provides high-performance similarity search over HTTP REST endpoints.",
            },
        },
    ],
    queryVector: [0.88, 0.22, 0.10, 0.65],
}

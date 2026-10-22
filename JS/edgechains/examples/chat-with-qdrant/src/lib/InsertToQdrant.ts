import { Qdrant, QdrantDistanceMetric } from "@arakoodev/edgechains.js/vector-db";
import { localEmbed } from "./localEmbed.js";

export const SAMPLE_DOCS = [
    {
        id: 1,
        content:
            "EdgeChains is a Generative AI framework built on jsonnet and hono. Prompts live in jsonnet so they are versionable and testable.",
        filename: "edgechains.md",
    },
    {
        id: 2,
        content:
            "This EdgeChains Qdrant client calls the Qdrant REST API directly with axios. It does not use the official @qdrant/js-client-rest package.",
        filename: "qdrant-client.md",
    },
    {
        id: 3,
        content:
            "HydeSearch embeds hypothetical answers and retrieves nearby documents from a vector database such as Postgres or Qdrant.",
        filename: "hyde.md",
    },
];

export const VECTOR_SIZE = 32;
export const COLLECTION_NAME = "documents";
export const NAMESPACE = "edgechains-docs";

export async function insertSampleDocs(qdrant: Qdrant): Promise<void> {
    await qdrant.createCollectionIfNotExists({
        collectionName: COLLECTION_NAME,
        vectorSize: VECTOR_SIZE,
        distance: QdrantDistanceMetric.COSINE,
    });

    await qdrant.upsert({
        collectionName: COLLECTION_NAME,
        points: SAMPLE_DOCS.map((doc) => ({
            id: doc.id,
            vector: localEmbed(doc.content, VECTOR_SIZE),
            payload: {
                content: doc.content,
                raw_text: doc.content,
                filename: doc.filename,
                namespace: NAMESPACE,
            },
        })),
    });
}

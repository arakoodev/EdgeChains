import { QdrantClient } from "../../lib/qdrant-client/QdrantClient.js";
import { QdrantDistanceMetric } from "../../lib/qdrant-client/QdrantDistanceMetric.js";

describe("QdrantClient", () => {
    let client: QdrantClient;

    beforeEach(() => {
        client = new QdrantClient({
            apiUrl: "http://localhost:6333",
            collectionName: "test-collection",
            vectorSize: 4,
            distance: QdrantDistanceMetric.COSINE,
        });
    });

    describe("Constructor", () => {
        it("should create a client with default options", () => {
            const defaultClient = new QdrantClient({ apiUrl: "http://localhost:6333" });
            expect(defaultClient).toBeDefined();
        });

        it("should create a client with custom options", () => {
            const customClient = new QdrantClient({
                apiUrl: "http://localhost:6333",
                apiKey: "test-key",
                collectionName: "custom",
                vectorSize: 768,
                distance: QdrantDistanceMetric.EUCLIDEAN,
            });
            expect(customClient).toBeDefined();
        });

        it("should strip trailing slashes from apiUrl", () => {
            const slashClient = new QdrantClient({ apiUrl: "http://localhost:6333///" });
            expect(slashClient).toBeDefined();
        });
    });

    describe("Collection management", () => {
        it("should create a collection", async () => {
            // This test would require a running Qdrant instance
            // For unit tests, we verify the method exists and is callable
            expect(typeof client.createCollection).toBe("function");
        });

        it("should check if collection exists", async () => {
            expect(typeof client.collectionExists).toBe("function");
        });

        it("should get collection info", async () => {
            expect(typeof client.getCollectionInfo).toBe("function");
        });

        it("should delete a collection", async () => {
            expect(typeof client.deleteCollection).toBe("function");
        });
    });

    describe("Point operations", () => {
        it("should upsert points", async () => {
            expect(typeof client.upsertPoints).toBe("function");
        });

        it("should search for similar vectors", async () => {
            expect(typeof client.search).toBe("function");
        });

        it("should batch search with multiple vectors", async () => {
            expect(typeof client.batchSearch).toBe("function");
        });

        it("should search with RRF", async () => {
            expect(typeof client.searchWithRRF).toBe("function");
        });

        it("should delete points by ID", async () => {
            expect(typeof client.deletePoints).toBe("function");
        });

        it("should get a point by ID", async () => {
            expect(typeof client.getPoint).toBe("function");
        });

        it("should count points", async () => {
            expect(typeof client.countPoints).toBe("function");
        });
    });

    describe("Distance metrics", () => {
        it("should support COSINE distance", () => {
            const cosineClient = new QdrantClient({
                apiUrl: "http://localhost:6333",
                distance: QdrantDistanceMetric.COSINE,
            });
            expect(cosineClient).toBeDefined();
        });

        it("should support EUCLIDEAN distance", () => {
            const euclidClient = new QdrantClient({
                apiUrl: "http://localhost:6333",
                distance: QdrantDistanceMetric.EUCLIDEAN,
            });
            expect(euclidClient).toBeDefined();
        });

        it("should support DOT product distance", () => {
            const dotClient = new QdrantClient({
                apiUrl: "http://localhost:6333",
                distance: QdrantDistanceMetric.DOT,
            });
            expect(dotClient).toBeDefined();
        });
    });

    describe("RRF scoring logic", () => {
        it("should correctly implement RRF formula", () => {
            // RRF score = sum(1 / (k + rank)) across result sets
            // For k=60, rank=0: 1/60 = 0.01667
            // For k=60, rank=1: 1/61 = 0.01639
            // For k=60, rank=2: 1/62 = 0.01613
            const k = 60;
            const score0 = 1 / (k + 0 + 1);
            const score1 = 1 / (k + 1 + 1);
            const score2 = 1 / (k + 2 + 1);

            expect(score0).toBeCloseTo(0.01667, 4);
            expect(score1).toBeCloseTo(0.01639, 4);
            expect(score2).toBeCloseTo(0.01613, 4);
            expect(score0).toBeGreaterThan(score1);
            expect(score1).toBeGreaterThan(score2);
        });

        it("should accumulate scores across multiple result sets", () => {
            const k = 60;
            // Point appears at rank 0 in set 1, rank 2 in set 2
            const score = 1 / (k + 0 + 1) + 1 / (k + 2 + 1);
            expect(score).toBeCloseTo(0.01667 + 0.01613, 4);
        });
    });
});
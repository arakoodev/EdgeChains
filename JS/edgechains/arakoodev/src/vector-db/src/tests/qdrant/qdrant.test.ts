import { describe, expect, test, mock, beforeEach } from "bun:test";
import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

describe("Qdrant Vector Database Client", () => {
    test("initializes with url string and api key", () => {
        const qdrant = new Qdrant("https://qdrant.example.com:6333", "mock-api-key");
        expect(qdrant.url).toBe("https://qdrant.example.com:6333");
        expect(qdrant.apiKey).toBe("mock-api-key");
    });

    test("initializes with options object and trims trailing slash", () => {
        const qdrant = new Qdrant({
            url: "https://qdrant.example.com:6333/",
            apiKey: "opt-api-key",
        });
        expect(qdrant.url).toBe("https://qdrant.example.com:6333");
        expect(qdrant.apiKey).toBe("opt-api-key");
    });

    test("falls back to environment variables when options omitted", () => {
        const oldUrl = process.env.QDRANT_URL;
        const oldKey = process.env.QDRANT_API_KEY;

        process.env.QDRANT_URL = "http://env-qdrant:6333";
        process.env.QDRANT_API_KEY = "env-secret-key";

        try {
            const qdrant = new Qdrant();
            expect(qdrant.url).toBe("http://env-qdrant:6333");
            expect(qdrant.apiKey).toBe("env-secret-key");
        } finally {
            if (oldUrl !== undefined) process.env.QDRANT_URL = oldUrl;
            else delete process.env.QDRANT_URL;
            if (oldKey !== undefined) process.env.QDRANT_API_KEY = oldKey;
            else delete process.env.QDRANT_API_KEY;
        }
    });

    test("createCollection sends PUT request with vector configuration", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-key");
        const client = qdrant.getClient();

        let capturedUrl = "";
        let capturedData: any = null;

        client.put = mock(async (url: string, data: any) => {
            capturedUrl = url;
            capturedData = data;
            return { data: { result: true, status: "ok" } };
        }) as any;

        const res = await qdrant.createCollection({
            collectionName: "knowledge_base",
            vectorSize: 1536,
            distance: "Cosine",
            onDisk: true,
        });

        expect(capturedUrl).toBe("/collections/knowledge_base");
        expect(capturedData.vectors.size).toBe(1536);
        expect(capturedData.vectors.distance).toBe("Cosine");
        expect(capturedData.on_disk_payload).toBe(true);
        expect(res.status).toBe("ok");
    });

    test("upsert inserts vector points into collection via REST API", async () => {
        const qdrant = new Qdrant("http://localhost:6333");
        const client = qdrant.getClient();

        let capturedUrl = "";
        let capturedData: any = null;

        client.put = mock(async (url: string, data: any) => {
            capturedUrl = url;
            capturedData = data;
            return {
                data: {
                    result: { operation_id: 1, status: "completed" },
                    status: "ok",
                },
            };
        }) as any;

        const points = [
            {
                id: "doc-1",
                vector: [0.1, 0.2, 0.3],
                payload: { text: "EdgeChains architecture overview", category: "engineering" },
            },
            {
                id: "doc-2",
                vector: [0.4, 0.5, 0.6],
                payload: { text: "Qdrant REST integration", category: "database" },
            },
        ];

        const res = await qdrant.upsert({
            collectionName: "knowledge_base",
            points,
            wait: true,
        });

        expect(capturedUrl).toBe("/collections/knowledge_base/points?wait=true");
        expect(capturedData.points.length).toBe(2);
        expect(capturedData.points[0].id).toBe("doc-1");
        expect(res.status).toBe("ok");
        expect(res.result.status).toBe("completed");
    });

    test("insertVectorData alias delegates to upsert", async () => {
        const qdrant = new Qdrant("http://localhost:6333");
        const client = qdrant.getClient();

        let called = false;
        client.put = mock(async () => {
            called = true;
            return { data: { status: "ok" } };
        }) as any;

        await qdrant.insertVectorData({
            collectionName: "test_coll",
            points: [{ id: 1, vector: [0.1] }],
        });

        expect(called).toBe(true);
    });

    test("search performs similarity search with vector and filter", async () => {
        const qdrant = new Qdrant("http://localhost:6333");
        const client = qdrant.getClient();

        let capturedUrl = "";
        let capturedData: any = null;

        const mockResults = [
            {
                id: "doc-1",
                version: 1,
                score: 0.95,
                payload: { text: "EdgeChains architecture overview" },
            },
        ];

        client.post = mock(async (url: string, data: any) => {
            capturedUrl = url;
            capturedData = data;
            return { data: { result: mockResults } };
        }) as any;

        const filter = {
            must: [{ key: "category", match: { value: "engineering" } }],
        };

        const results = await qdrant.search({
            collectionName: "knowledge_base",
            vector: [0.1, 0.2, 0.3],
            limit: 5,
            filter,
            scoreThreshold: 0.8,
            withPayload: true,
        });

        expect(capturedUrl).toBe("/collections/knowledge_base/points/search");
        expect(capturedData.vector).toEqual([0.1, 0.2, 0.3]);
        expect(capturedData.limit).toBe(5);
        expect(capturedData.filter).toEqual(filter);
        expect(capturedData.score_threshold).toBe(0.8);
        expect(capturedData.with_payload).toBe(true);
        expect(results.length).toBe(1);
        expect(results[0].id).toBe("doc-1");
        expect(results[0].score).toBe(0.95);
    });

    test("getPoint retrieves single point by ID with payload options", async () => {
        const qdrant = new Qdrant("http://localhost:6333");
        const client = qdrant.getClient();

        let capturedUrl = "";
        client.get = mock(async (url: string) => {
            capturedUrl = url;
            return {
                data: {
                    result: {
                        id: "doc-1",
                        payload: { title: "Test Doc" },
                        vector: [0.1, 0.2],
                    },
                },
            };
        }) as any;

        const point = await qdrant.getPoint({
            collectionName: "knowledge_base",
            id: "doc-1",
            withPayload: true,
            withVector: true,
        });

        expect(capturedUrl).toContain("/collections/knowledge_base/points/doc-1");
        expect(capturedUrl).toContain("with_payload=true");
        expect(capturedUrl).toContain("with_vector=true");
        expect(point.id).toBe("doc-1");
        expect(point.payload.title).toBe("Test Doc");
    });

    test("deletePoints deletes points by IDs", async () => {
        const qdrant = new Qdrant("http://localhost:6333");
        const client = qdrant.getClient();

        let capturedUrl = "";
        let capturedData: any = null;

        client.post = mock(async (url: string, data: any) => {
            capturedUrl = url;
            capturedData = data;
            return { data: { result: { status: "completed" } } };
        }) as any;

        const res = await qdrant.deletePoints({
            collectionName: "knowledge_base",
            points: ["doc-1", "doc-2"],
            wait: true,
        });

        expect(capturedUrl).toBe("/collections/knowledge_base/points/delete?wait=true");
        expect(capturedData.points).toEqual(["doc-1", "doc-2"]);
        expect(res.result.status).toBe("completed");
    });

    test("setPayload updates point metadata", async () => {
        const qdrant = new Qdrant("http://localhost:6333");
        const client = qdrant.getClient();

        let capturedUrl = "";
        let capturedData: any = null;

        client.post = mock(async (url: string, data: any) => {
            capturedUrl = url;
            capturedData = data;
            return { data: { status: "ok" } };
        }) as any;

        await qdrant.setPayload({
            collectionName: "knowledge_base",
            points: ["doc-1"],
            payload: { verified: true },
        });

        expect(capturedUrl).toBe("/collections/knowledge_base/points/payload?wait=true");
        expect(capturedData.points).toEqual(["doc-1"]);
        expect(capturedData.payload).toEqual({ verified: true });
    });
});

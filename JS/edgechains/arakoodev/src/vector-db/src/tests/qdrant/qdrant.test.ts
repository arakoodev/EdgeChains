import { Qdrant } from "../../lib/qdrant/qdrant.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Qdrant", () => {
    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ result: "ok" }),
        });
    });

    it("creates a client from constructor values", () => {
        const qdrant = new Qdrant("https://example-qdrant.io/", "mock-api-key");

        expect(qdrant.createClient()).toEqual({
            url: "https://example-qdrant.io",
            apiKey: "mock-api-key",
        });
    });

    it("creates a collection through the Qdrant REST API", async () => {
        const qdrant = new Qdrant("https://example-qdrant.io", "mock-api-key");
        const client = qdrant.createClient();

        await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "https://example-qdrant.io/collections/documents",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": "mock-api-key",
                }),
                body: JSON.stringify({
                    vectors: {
                        size: 1536,
                        distance: "Cosine",
                    },
                }),
            })
        );
    });

    it("inserts vector data as a Qdrant point", async () => {
        const qdrant = new Qdrant("https://example-qdrant.io", "mock-api-key");
        const client = qdrant.createClient();

        await qdrant.insertVectorData({
            client,
            collectionName: "documents",
            id: 1,
            embedding: [0.1, 0.2, 0.3],
            content: "hello",
            filename: "sample.txt",
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "https://example-qdrant.io/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [
                        {
                            id: 1,
                            vector: [0.1, 0.2, 0.3],
                            payload: {
                                content: "hello",
                                filename: "sample.txt",
                            },
                        },
                    ],
                }),
            })
        );
    });

    it("searches vector data through the Qdrant REST API", async () => {
        const qdrant = new Qdrant("https://example-qdrant.io", "mock-api-key");
        const client = qdrant.createClient();

        await qdrant.searchVectorData({
            client,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: {
                must: [
                    {
                        key: "filename",
                        match: { value: "sample.txt" },
                    },
                ],
            },
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "https://example-qdrant.io/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 3,
                    filter: {
                        must: [
                            {
                                key: "filename",
                                match: { value: "sample.txt" },
                            },
                        ],
                    },
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });
});

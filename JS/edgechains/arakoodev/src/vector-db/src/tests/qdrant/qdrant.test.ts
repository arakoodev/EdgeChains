import { describe, expect, it, vi } from "vitest";
import axios, { type AxiosInstance } from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

vi.mock("axios", () => ({
    default: {
        create: vi.fn(),
    },
}));

const createMockClient = (): AxiosInstance => {
    return {
        put: vi.fn().mockResolvedValue({ data: { status: "ok" } }),
        post: vi.fn().mockResolvedValue({ data: { result: [] } }),
        get: vi.fn().mockResolvedValue({ data: { result: { id: 1 } } }),
    } as unknown as AxiosInstance;
};

describe("Qdrant", () => {
    it("creates an axios client with Qdrant headers", () => {
        const mockClient = createMockClient();
        vi.mocked(axios.create).mockReturnValue(mockClient);

        const qdrant = new Qdrant({
            url: "https://example.qdrant.io/",
            apiKey: "test-key",
            timeout: 1000,
        });

        expect(qdrant.createClient()).toBe(mockClient);
        expect(axios.create).toHaveBeenCalledWith({
            baseURL: "https://example.qdrant.io",
            timeout: 1000,
            headers: {
                "Content-Type": "application/json",
                "api-key": "test-key",
            },
        });
    });

    it("creates a collection with vector size and distance", async () => {
        const client = createMockClient();
        const qdrant = new Qdrant();

        await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
            distance: "Cosine",
        });

        expect(client.put).toHaveBeenCalledWith("/collections/documents", {
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
        });
    });

    it("upserts a single vector point", async () => {
        const client = createMockClient();
        const qdrant = new Qdrant();

        await qdrant.insertVectorData({
            client,
            collectionName: "documents",
            id: 1,
            vector: [0.1, 0.2, 0.3],
            payload: { content: "hello" },
        });

        expect(client.put).toHaveBeenCalledWith("/collections/documents/points", {
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { content: "hello" },
                },
            ],
        });
    });

    it("searches points by vector", async () => {
        const client = createMockClient();
        const qdrant = new Qdrant();

        await qdrant.search({
            client,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: { must: [{ key: "source", match: { value: "docs" } }] },
        });

        expect(client.post).toHaveBeenCalledWith("/collections/documents/points/search", {
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: { must: [{ key: "source", match: { value: "docs" } }] },
            with_payload: true,
            with_vector: false,
        });
    });

    it("gets and deletes points by id", async () => {
        const client = createMockClient();
        const qdrant = new Qdrant();

        await qdrant.getDataById({ client, collectionName: "documents", id: 1 });
        await qdrant.deleteById({ client, collectionName: "documents", id: 1 });

        expect(client.get).toHaveBeenCalledWith("/collections/documents/points/1");
        expect(client.post).toHaveBeenCalledWith("/collections/documents/points/delete", {
            points: [1],
        });
    });
});

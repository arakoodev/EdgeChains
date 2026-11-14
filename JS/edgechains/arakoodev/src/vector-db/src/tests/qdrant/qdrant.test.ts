import { describe, it, expect, vi, beforeEach } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

vi.mock("@qdrant/js-client-rest", () => {
    return {
        QdrantClient: vi.fn().mockImplementation(() => {
            return {
                upsert: vi.fn().mockResolvedValue({ status: "ok" }),
                query: vi.fn().mockResolvedValue([{ id: 1, score: 0.9 }]),
                retrieve: vi.fn().mockResolvedValue([{ id: 1, payload: {} }]),
                delete: vi.fn().mockResolvedValue({ status: "ok" }),
            };
        }),
    };
});

describe("Qdrant Vector DB", () => {
    let qdrant: Qdrant;
    let client: any;

    beforeEach(() => {
        vi.clearAllMocks();
        qdrant = new Qdrant("http://localhost:6333", "dummy-api-key");
        client = qdrant.createClient();
    });

    it("should insert vector data", async () => {
        const res = await qdrant.insertVectorData({
            client,
            collectionName: "test-collection",
            points: [{ id: 1, vector: [0.1, 0.2] }]
        });
        expect(res).toEqual({ status: "ok" });
        expect(client.upsert).toHaveBeenCalledWith("test-collection", expect.objectContaining({
            wait: true,
            points: [{ id: 1, vector: [0.1, 0.2] }]
        }));
    });

    it("should search vector data", async () => {
        const res = await qdrant.search({
            client,
            collectionName: "test-collection",
            vector: [0.1, 0.2],
            limit: 5
        });
        expect(res).toEqual([{ id: 1, score: 0.9 }]);
        expect(client.query).toHaveBeenCalledWith("test-collection", expect.objectContaining({
            query: [0.1, 0.2],
            limit: 5
        }));
    });

    it("should get data by id", async () => {
        const res = await qdrant.getDataById({
            client,
            collectionName: "test-collection",
            id: 1
        });
        expect(res).toEqual([{ id: 1, payload: {} }]);
        expect(client.retrieve).toHaveBeenCalledWith("test-collection", expect.objectContaining({
            ids: [1]
        }));
    });

    it("should delete data by id", async () => {
        const res = await qdrant.deleteById({
            client,
            collectionName: "test-collection",
            id: 1
        });
        expect(res).toEqual({ status: "ok" });
        expect(client.delete).toHaveBeenCalledWith("test-collection", expect.objectContaining({
            wait: true,
            points: [1]
        }));
    });
});

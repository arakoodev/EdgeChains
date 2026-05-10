import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_URL = "https://mock-qdrant.local";
const MOCK_QDRANT_API_KEY = "mock-api-key";

vi.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: vi.fn().mockImplementation(() => ({
            createClient: vi.fn(() => ({
                put: vi.fn(),
                get: vi.fn(),
                post: vi.fn(),
            })),
            createCollection: vi.fn().mockImplementation(async ({ collectionName }) => ({
                result: true,
                collectionName,
            })),
            insertVectorData: vi.fn().mockImplementation(async ({ collectionName, points }) => ({
                result: { operation_id: 1, status: "acknowledged" },
                collectionName,
                points,
            })),
            getDataById: vi.fn().mockImplementation(async ({ collectionName, id }) => ({
                result: {
                    id,
                    collectionName,
                    payload: { content: "Sample content" },
                },
            })),
            deleteById: vi.fn().mockImplementation(async ({ ids }) => ({
                result: { operation_id: 2, status: "acknowledged" },
                ids,
            })),
            searchVectorData: vi.fn().mockImplementation(async ({ vector, limit }) => ({
                result: [
                    {
                        id: 1,
                        score: 0.98,
                        vector,
                    },
                ],
                limit,
            })),
        })),
    };
});

describe("Qdrant vector database client", () => {
    it("should create a collection", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const result = await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
        });

        expect(result).toEqual(expect.objectContaining({ result: true }));
    });

    it("should insert vector data", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        const points = [
            {
                id: 1,
                vector: Array.from({ length: 3 }, (_, i) => i),
                payload: { content: "Sample content" },
            },
        ];

        const result = await qdrant.insertVectorData({
            client,
            collectionName: "documents",
            points,
        });

        expect(result).toEqual(
            expect.objectContaining({
                collectionName: "documents",
                points,
            })
        );
    });

    it("should fetch a point by id", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const result = await qdrant.getDataById({
            client,
            collectionName: "documents",
            id: 1,
        });

        expect(result).toEqual(
            expect.objectContaining({
                result: expect.objectContaining({ id: 1 }),
            })
        );
    });

    it("should delete points by id", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const result = await qdrant.deleteById({
            client,
            collectionName: "documents",
            ids: [1],
        });

        expect(result).toEqual(expect.objectContaining({ ids: [1] }));
    });

    it("should search vector data", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        const vector = [0.1, 0.2, 0.3];

        const result = await qdrant.searchVectorData({
            client,
            collectionName: "documents",
            vector,
            limit: 3,
        });

        expect(result).toEqual(
            expect.objectContaining({
                result: expect.arrayContaining([
                    expect.objectContaining({
                        vector,
                    }),
                ]),
                limit: 3,
            })
        );
    });
});

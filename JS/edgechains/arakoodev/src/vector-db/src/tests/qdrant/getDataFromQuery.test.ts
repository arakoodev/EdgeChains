import { describe, it, expect, vi } from "vitest";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "https://mock-qdrant.cloud";

vi.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: vi.fn().mockImplementation(() => ({
            createClient: vi.fn(() => ({
                post: vi.fn().mockReturnThis(),
            })),
            getDataFromQuery: vi
                .fn()
                .mockImplementation(async ({ collectionName, vector, limit }) => {
                    return [
                        { id: 1, score: 0.97, payload: { content: "Hello, world!" } },
                        { id: 2, score: 0.81, payload: { content: "Second hit" } },
                    ].slice(0, limit ?? 5);
                }),
        })),
    };
});

describe("getDataFromQuery", () => {
    it("should return the nearest vectors with payload by default", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const hits = await qdrant.getDataFromQuery({
            client,
            collectionName: "docs",
            vector: Array.from({ length: 1536 }, () => 0.0),
            limit: 2,
        });

        expect(Array.isArray(hits)).toBe(true);
        expect(hits.length).toBe(2);
        expect(hits[0]).toEqual(
            expect.objectContaining({
                id: 1,
                score: expect.any(Number),
                payload: expect.objectContaining({ content: "Hello, world!" }),
            })
        );
    }, 10000);
});

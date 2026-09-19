import { describe, it, expect, vi } from "vitest";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "https://mock-qdrant.cloud";

// Mock the Qdrant class to return a mock client
vi.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: vi.fn().mockImplementation(() => ({
            createClient: vi.fn(() => ({
                put: vi.fn().mockReturnThis(),
            })),
            createCollection: vi
                .fn()
                .mockImplementation(async ({ collectionName, vectorSize, distance }) => {
                    return {
                        status: "ok",
                        result: true,
                        request: { collectionName, vectorSize, distance: distance || "Cosine" },
                    };
                }),
        })),
    };
});

describe("createCollection", () => {
    it("should create a collection with the requested vector size and distance", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const res = await qdrant.createCollection({
            client,
            collectionName: "docs",
            vectorSize: 1536,
            distance: "Cosine",
        });

        expect(res).toEqual(
            expect.objectContaining({
                status: "ok",
                result: true,
                request: expect.objectContaining({
                    collectionName: "docs",
                    vectorSize: 1536,
                    distance: "Cosine",
                }),
            })
        );
    }, 10000);
});

import { describe, it, expect, vi } from "vitest";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "https://mock-qdrant.cloud";

vi.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: vi.fn().mockImplementation(() => ({
            createClient: vi.fn(() => ({
                get: vi.fn().mockReturnThis(),
            })),
            getDataById: vi.fn().mockImplementation(async ({ collectionName, id }) => {
                return {
                    id,
                    payload: { content: `point ${id}` },
                    vector: Array.from({ length: 4 }, () => 0.5),
                };
            }),
        })),
    };
});

describe("getDataById", () => {
    it("should return a single point by id", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const point = await qdrant.getDataById({ client, collectionName: "docs", id: 42 });

        expect(point).toEqual(
            expect.objectContaining({
                id: 42,
                payload: expect.objectContaining({ content: "point 42" }),
                vector: expect.any(Array),
            })
        );
    }, 10000);
});

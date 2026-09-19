import { describe, it, expect, vi } from "vitest";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "https://mock-qdrant.cloud";

vi.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: vi.fn().mockImplementation(() => ({
            createClient: vi.fn(() => ({
                put: vi.fn().mockReturnThis(),
            })),
            insertVectorData: vi
                .fn()
                .mockImplementation(async ({ collectionName, points }) => {
                    return {
                        status: "ok",
                        result: { operation_id: 1, status: "completed" },
                        collectionName,
                        upserted: points.length,
                    };
                }),
        })),
    };
});

describe("insertVectorData", () => {
    it("should upsert one or more points into the collection", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        const collectionName = "docs";
        const points = [
            {
                id: 1,
                vector: Array.from({ length: 1536 }, (_, i) => i / 1536),
                payload: { content: "hello world" },
            },
        ];

        const res = await qdrant.insertVectorData({ client, collectionName, points });

        expect(res).toEqual(
            expect.objectContaining({
                status: "ok",
                collectionName,
                upserted: 1,
                result: expect.objectContaining({ status: "completed" }),
            })
        );
    }, 10000);
});

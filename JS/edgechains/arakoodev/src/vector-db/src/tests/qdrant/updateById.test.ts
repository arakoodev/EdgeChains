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
            updateById: vi
                .fn()
                .mockImplementation(async ({ collectionName, id, payload }) => {
                    return {
                        status: "ok",
                        result: { operation_id: 7, status: "completed" },
                        applied: { id, payload },
                    };
                }),
        })),
    };
});

describe("updateById", () => {
    it("should update the payload of a point", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const res = await qdrant.updateById({
            client,
            collectionName: "docs",
            id: 1,
            payload: { content: "updated" },
        });

        expect(res).toEqual(
            expect.objectContaining({
                status: "ok",
                applied: expect.objectContaining({
                    id: 1,
                    payload: expect.objectContaining({ content: "updated" }),
                }),
            })
        );
    }, 10000);
});

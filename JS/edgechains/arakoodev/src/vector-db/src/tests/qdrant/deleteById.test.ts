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
            deleteById: vi.fn().mockImplementation(async ({ collectionName, id }) => {
                return {
                    status: 200,
                    messages: "OK",
                    data: {
                        status: "ok",
                        result: { operation_id: 9, status: "completed" },
                        deleted: { collectionName, id },
                    },
                };
            }),
        })),
    };
});

describe("deleteById", () => {
    it("should delete a point by id", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const res = await qdrant.deleteById({ client, collectionName: "docs", id: 1 });

        expect(res).toEqual(
            expect.objectContaining({
                status: 200,
                messages: "OK",
                data: expect.objectContaining({
                    status: "ok",
                    deleted: expect.objectContaining({ id: 1 }),
                }),
            })
        );
    }, 10000);
});

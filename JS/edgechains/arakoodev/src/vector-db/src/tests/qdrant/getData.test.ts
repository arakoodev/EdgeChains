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
            getData: vi
                .fn()
                .mockImplementation(async ({ collectionName, limit }) => {
                    return {
                        points: [
                            { id: 1, payload: { content: "first" } },
                            { id: 2, payload: { content: "second" } },
                        ].slice(0, limit ?? 100),
                        next_page_offset: null,
                    };
                }),
        })),
    };
});

describe("getData (scroll)", () => {
    it("should return a paginated list of points", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const res = await qdrant.getData({ client, collectionName: "docs", limit: 2 });

        expect(res).toEqual(
            expect.objectContaining({
                points: expect.arrayContaining([
                    expect.objectContaining({ id: 1 }),
                    expect.objectContaining({ id: 2 }),
                ]),
                next_page_offset: null,
            })
        );
    }, 10000);
});

import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "http://localhost:6333";

describe("getData", () => {
  it("should scroll and return the points of the collection", async () => {
    const mockPoints = [
      { id: 1, payload: { content: "Hello, world!" }, vector: [0.1, 0.2] },
      { id: 2, payload: { content: "Hello again" }, vector: [0.3, 0.4] },
    ];
    const post = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        result: { points: mockPoints, next_page_offset: null },
        status: "ok",
        time: 0.01,
      },
    });
    const client: any = { post };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const res = await qdrant.getData({
      client,
      collectionName: "test_collection",
      limit: 2,
    });

    expect(post).toHaveBeenCalledWith(
      "/collections/test_collection/points/scroll",
      {
        limit: 2,
        with_payload: true,
        with_vector: true,
      },
    );
    expect(res).toEqual(mockPoints);
  }, 10000);
});

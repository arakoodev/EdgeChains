import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "http://localhost:6333";

describe("getDataById", () => {
  it("should fetch a point by id from the collection", async () => {
    const mockPoint = {
      id: 1,
      payload: { content: "Hello, world!" },
      vector: [0.1, 0.2],
    };
    const post = vi.fn().mockResolvedValue({
      status: 200,
      data: { result: [mockPoint], status: "ok", time: 0.01 },
    });
    const client: any = { post };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const res = await qdrant.getDataById({
      client,
      collectionName: "test_collection",
      id: 1,
    });

    expect(post).toHaveBeenCalledWith("/collections/test_collection/points", {
      ids: [1],
      with_payload: true,
      with_vector: true,
    });
    expect(res).toEqual(mockPoint);
  }, 10000);
});

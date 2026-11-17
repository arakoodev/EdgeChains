import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "http://localhost:6333";

describe("deleteById", () => {
  it("should delete a point by id from the collection", async () => {
    const post = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      data: {
        result: { operation_id: 1, status: "completed" },
        status: "ok",
        time: 0.01,
      },
    });
    const client: any = { post };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const res = await qdrant.deleteById({
      client,
      collectionName: "test_collection",
      id: 1,
    });

    expect(post).toHaveBeenCalledWith(
      "/collections/test_collection/points/delete?wait=true",
      {
        points: [1],
      },
    );
    expect(res).toEqual({ status: 200, messages: "OK" });
  }, 10000);
});

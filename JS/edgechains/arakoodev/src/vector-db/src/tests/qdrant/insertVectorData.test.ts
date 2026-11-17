import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "http://localhost:6333";

describe("insertVectorData", () => {
  it("should insert points into the collection", async () => {
    const put = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        result: { operation_id: 1, status: "completed" },
        status: "ok",
        time: 0.01,
      },
    });
    const client: any = { put };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const points = [
      {
        id: 1,
        vector: Array.from({ length: 1536 }, (_, i) => i),
        payload: { content: "test" },
      },
    ];
    const result = await qdrant.insertVectorData({
      client,
      collectionName: "test_collection",
      points,
    });

    expect(put).toHaveBeenCalledWith(
      "/collections/test_collection/points?wait=true",
      {
        points: points,
      },
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: "ok",
        result: expect.objectContaining({ status: "completed" }),
      }),
    );
  }, 10000);
});

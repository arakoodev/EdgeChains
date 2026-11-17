import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "http://localhost:6333";

describe("updateById", () => {
  it("should upsert the point when a new vector is given", async () => {
    const put = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        result: { operation_id: 1, status: "completed" },
        status: "ok",
        time: 0.01,
      },
    });
    const client: any = { put, post: vi.fn() };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const result = await qdrant.updateById({
      client,
      collectionName: "test_collection",
      id: 1,
      updatedContent: { vector: [0.5, 0.6], payload: { content: "updated" } },
    });

    expect(put).toHaveBeenCalledWith(
      "/collections/test_collection/points?wait=true",
      {
        points: [
          { id: 1, vector: [0.5, 0.6], payload: { content: "updated" } },
        ],
      },
    );
    expect(result).toEqual(expect.objectContaining({ status: "ok" }));
  }, 10000);

  it("should overwrite only the payload when no vector is given", async () => {
    const post = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        result: { operation_id: 2, status: "completed" },
        status: "ok",
        time: 0.01,
      },
    });
    const client: any = { put: vi.fn(), post };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    await qdrant.updateById({
      client,
      collectionName: "test_collection",
      id: 1,
      updatedContent: { payload: { content: "updated" } },
    });

    expect(post).toHaveBeenCalledWith(
      "/collections/test_collection/points/payload?wait=true",
      {
        payload: { content: "updated" },
        points: [1],
      },
    );
  }, 10000);
});

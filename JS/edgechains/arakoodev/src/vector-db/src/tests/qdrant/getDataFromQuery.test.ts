import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "http://localhost:6333";

describe("getDataFromQuery", () => {
  it("should search the collection and return the closest points", async () => {
    const mockResponseData = [
      { id: 1, score: 0.98, payload: { content: "Hello, world!" } },
      { id: 2, score: 0.87, payload: { content: "Hello again" } },
    ];
    const post = vi.fn().mockResolvedValue({
      status: 200,
      data: { result: mockResponseData, status: "ok", time: 0.01 },
    });
    const client: any = { post };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const queryVector = [0.1, 0.2, 0.3];
    const res = await qdrant.getDataFromQuery({
      client,
      collectionName: "test_collection",
      queryVector,
      limit: 2,
    });

    expect(post).toHaveBeenCalledWith(
      "/collections/test_collection/points/search",
      {
        vector: queryVector,
        limit: 2,
        with_payload: true,
      },
    );
    expect(res).toEqual(mockResponseData);
  }, 10000);

  it("should pass a filter through to the search request", async () => {
    const post = vi.fn().mockResolvedValue({
      status: 200,
      data: { result: [], status: "ok", time: 0.01 },
    });
    const client: any = { post };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const filter = {
      must: [{ key: "namespace", match: { value: "360_docs" } }],
    };
    await qdrant.getDataFromQuery({
      client,
      collectionName: "test_collection",
      queryVector: [0.1, 0.2, 0.3],
      filter,
    });

    expect(post).toHaveBeenCalledWith(
      "/collections/test_collection/points/search",
      expect.objectContaining({ filter: filter }),
    );
  }, 10000);
});

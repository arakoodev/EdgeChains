import {
  Qdrant,
  QdrantDistanceMetric,
} from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "http://localhost:6333";

describe("createCollection", () => {
  it("should create a collection with the default cosine distance", async () => {
    const put = vi.fn().mockResolvedValue({
      status: 200,
      data: { result: true, status: "ok", time: 0.01 },
    });
    const client: any = { put };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const result = await qdrant.createCollection({
      client,
      collectionName: "test_collection",
      vectorSize: 1536,
    });

    expect(put).toHaveBeenCalledWith("/collections/test_collection", {
      vectors: { size: 1536, distance: "Cosine" },
    });
    expect(result).toEqual({ result: true, status: "ok", time: 0.01 });
  }, 10000);

  it("should create a collection with a given distance metric", async () => {
    const put = vi.fn().mockResolvedValue({
      status: 200,
      data: { result: true, status: "ok", time: 0.01 },
    });
    const client: any = { put };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    await qdrant.createCollection({
      client,
      collectionName: "test_collection",
      vectorSize: 384,
      distance: QdrantDistanceMetric.EUCLID,
    });

    expect(put).toHaveBeenCalledWith("/collections/test_collection", {
      vectors: { size: 384, distance: "Euclid" },
    });
  }, 10000);

  it("should throw the qdrant error message when creation fails", async () => {
    const put = vi.fn().mockRejectedValue({
      response: {
        data: { status: { error: "Wrong input: Collection already exists" } },
      },
    });
    const client: any = { put };

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    await expect(
      qdrant.createCollection({
        client,
        collectionName: "test_collection",
        vectorSize: 1536,
      }),
    ).rejects.toThrow(
      'Qdrant request failed with error message "Wrong input: Collection already exists"',
    );
  }, 10000);

  it("createClient should return a client configured with the url and api key", () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    expect(client.defaults.baseURL).toBe(MOCK_QDRANT_URL);
    expect(client.defaults.headers["api-key"]).toBe(MOCK_QDRANT_API_KEY);
  }, 10000);
});

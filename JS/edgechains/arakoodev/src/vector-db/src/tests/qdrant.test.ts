import { describe, it, expect, vi } from "vitest";
import { Qdrant } from "../lib/qdrant/qdrant";
import axios from "axios";

// Mock axios
vi.mock("axios");

describe("Qdrant", () => {
  const qdrant = new Qdrant({
    url: "http://localhost:6333",
    apiKey: "test-api-key",
  });

  it("should create a collection", async () => {
    const mockResponse = { data: { result: "ok" } };
    (axios.put as any).mockResolvedValueOnce(mockResponse);

    const result = await qdrant.createCollection("test_collection", 1536);

    expect(axios.put).toHaveBeenCalledWith(
      "http://localhost:6333/collections/test_collection",
      {
        vectors: {
          size: 1536,
          distance: "Cosine",
        },
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          "api-key": "test-api-key",
        }),
      }),
    );
    expect(result.data.result).toBe("ok");
  });

  it("should upsert points", async () => {
    const mockResponse = { data: { result: "ok" } };
    (axios.put as any).mockResolvedValueOnce(mockResponse);

    const points = [
      { id: "1", vector: [0.1, 0.2], payload: { text: "hello" } },
    ];
    const result = await qdrant.upsert("test_collection", points);

    expect(axios.put).toHaveBeenCalledWith(
      "http://localhost:6333/collections/test_collection/points",
      { points },
      expect.any(Object),
    );
    expect(result.data.result).toBe("ok");
  });

  it("should search points", async () => {
    const mockResult = [{ id: "1", score: 0.9, payload: { text: "hello" } }];
    const mockResponse = { data: { result: mockResult } };
    (axios.post as any).mockResolvedValueOnce(mockResponse);

    const result = await qdrant.search({
      collectionName: "test_collection",
      vector: [0.1, 0.2],
      limit: 5,
    });

    expect(axios.post).toHaveBeenCalledWith(
      "http://localhost:6333/collections/test_collection/points/search",
      {
        vector: [0.1, 0.2],
        limit: 5,
        with_payload: true,
      },
      expect.any(Object),
    );
    expect(result).toEqual(mockResult);
  });

  it("should delete points", async () => {
    const mockResponse = { data: { result: "ok" } };
    (axios.post as any).mockResolvedValueOnce(mockResponse);

    const result = await qdrant.deletePoints("test_collection", ["1", "2"]);

    expect(axios.post).toHaveBeenCalledWith(
      "http://localhost:6333/collections/test_collection/points/delete",
      { points: ["1", "2"] },
      expect.any(Object),
    );
    expect(result.data.result).toBe("ok");
  });
});

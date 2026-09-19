import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const mockJson = (data: any, ok = true) =>
  Promise.resolve({ json: () => Promise.resolve(data), ok, status: ok ? 200 : 400 } as any);

describe("QdrantClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upsert points", async () => {
    mockFetch.mockResolvedValue(mockJson({ result: true }));
    const { QdrantClient } = await import("../../lib/qdrant/QdrantClient.js");
    const client = new QdrantClient("http://qdrant:6333");
    await client.upsert("test_collection", [{ id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "hello" } }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://qdrant:6333/collections/test_collection/points?wait=true",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("should search points", async () => {
    mockFetch.mockResolvedValue(mockJson({
      result: [
        { id: 1, score: 0.95, payload: { text: "result" } },
      ],
    }));
    const { QdrantClient } = await import("../../lib/qdrant/QdrantClient.js");
    const client = new QdrantClient("http://qdrant:6333");
    const results = await client.search("test_collection", [0.1, 0.2, 0.3], 5);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBeCloseTo(0.95);
  });

  it("should create collection", async () => {
    mockFetch.mockResolvedValue(mockJson({ result: true }));
    const { QdrantClient } = await import("../../lib/qdrant/QdrantClient.js");
    const client = new QdrantClient("http://qdrant:6333");
    await client.createCollection("vectors", { vectorSize: 128, distance: "Cosine" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://qdrant:6333/collections/vectors",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"size":128'),
      }),
    );
  });

  it("should delete points", async () => {
    mockFetch.mockResolvedValue(mockJson({ result: true }));
    const { QdrantClient } = await import("../../lib/qdrant/QdrantClient.js");
    const client = new QdrantClient("http://qdrant:6333");
    await client.deletePoints("test", [1, 2, 3]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://qdrant:6333/collections/test/points/delete",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should get collection info", async () => {
    mockFetch.mockResolvedValue(mockJson({
      result: { status: "green", vectors_count: 100 },
    }));
    const { QdrantClient } = await import("../../lib/qdrant/QdrantClient.js");
    const client = new QdrantClient("http://qdrant:6333");
    const info = await client.collectionInfo("test");
    expect(info.status).toBe("green");
    expect(info.vectors_count).toBe(100);
  });
});

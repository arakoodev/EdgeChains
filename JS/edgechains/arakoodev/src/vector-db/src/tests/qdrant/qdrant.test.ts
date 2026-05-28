import { describe, expect, it, vi } from "vitest";
import { Qdrant, QdrantHttpClient } from "../../lib/qdrant/qdrant.js";

describe("Qdrant", () => {
  it("creates a collection through the REST API", async () => {
    const { qdrant, client, request } = createQdrant();

    await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectorSize: 3,
      distance: "Dot",
    });

    expect(request).toHaveBeenCalledWith({
      method: "PUT",
      url: "http://localhost:6333/collections/documents",
      headers: {
        "Content-Type": "application/json",
        "api-key": "test-key",
      },
      data: {
        vectors: {
          size: 3,
          distance: "Dot",
        },
      },
    });
  });

  it("inserts vector data using the existing vector-db method shape", async () => {
    const { qdrant, client, request } = createQdrant();

    await qdrant.insertVectorData({
      client,
      tableName: "documents",
      id: "doc-1",
      embedding: [0.1, 0.2, 0.3],
      content: "hello qdrant",
      payload: { source: "unit-test" },
      namespace: "docs",
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: "http://localhost:6333/collections/documents/points?wait=true",
        data: {
          points: [
            {
              id: "doc-1",
              vector: [0.1, 0.2, 0.3],
              payload: {
                content: "hello qdrant",
                source: "unit-test",
                namespace: "docs",
              },
            },
          ],
        },
      }),
    );
  });

  it("searches vectors with Qdrant filters and payload options", async () => {
    const { qdrant, client, request } = createQdrant([
      { id: "doc-1", score: 0.9, payload: { content: "match" } },
    ]);

    const result = await qdrant.getDataFromQuery({
      client,
      collectionName: "documents",
      embedding: [0.1, 0.2, 0.3],
      limit: 5,
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
      withVector: true,
      scoreThreshold: 0.7,
    });

    expect(result).toEqual([
      { id: "doc-1", score: 0.9, payload: { content: "match" } },
    ]);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "http://localhost:6333/collections/documents/points/search",
        data: {
          vector: [0.1, 0.2, 0.3],
          limit: 5,
          filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
          with_payload: true,
          with_vector: true,
          score_threshold: 0.7,
        },
      }),
    );
  });

  it("retrieves, updates, scrolls, and deletes points by id", async () => {
    const { qdrant, client, request } = createQdrant();
    request
      .mockResolvedValueOnce({
        data: { result: [{ id: "doc-1", payload: { content: "a" } }] },
      })
      .mockResolvedValueOnce({ data: { result: { status: "updated" } } })
      .mockResolvedValueOnce({
        data: { result: { points: [{ id: "doc-1" }] } },
      })
      .mockResolvedValueOnce({ data: { result: { status: "deleted" } } });

    await expect(
      qdrant.getDataById({ client, tableName: "documents", id: "doc-1" }),
    ).resolves.toEqual({ id: "doc-1", payload: { content: "a" } });
    await expect(
      qdrant.updateById({
        client,
        tableName: "documents",
        id: "doc-1",
        updatedContent: { content: "updated" },
      }),
    ).resolves.toEqual({ status: "updated" });
    await expect(
      qdrant.getData({ client, tableName: "documents", limit: 1 }),
    ).resolves.toEqual({
      points: [{ id: "doc-1" }],
    });
    await expect(
      qdrant.deleteById({ client, tableName: "documents", id: "doc-1" }),
    ).resolves.toEqual({ status: "deleted" });

    expect(request.mock.calls.map(([config]) => config.url)).toEqual([
      "http://localhost:6333/collections/documents/points",
      "http://localhost:6333/collections/documents/points/payload?wait=true",
      "http://localhost:6333/collections/documents/points/scroll",
      "http://localhost:6333/collections/documents/points/delete?wait=true",
    ]);
  });

  it("validates required vectors and collection names", async () => {
    const { qdrant, client } = createQdrant();

    await expect(
      qdrant.search({ client, tableName: "documents" }),
    ).rejects.toThrow("Qdrant search requires an embedding or vector.");
    await expect(
      qdrant.insertVectorData({ client, embedding: [0.1, 0.2, 0.3] }),
    ).rejects.toThrow("Qdrant collectionName or tableName is required.");
  });
});

function createQdrant(result: unknown = { status: "ok" }) {
  const request = vi.fn().mockResolvedValue({ data: { result } });
  const httpClient = { request } as unknown as QdrantHttpClient;
  const qdrant = new Qdrant("http://localhost:6333/", "test-key", {
    httpClient,
  });

  return {
    qdrant,
    client: qdrant.createClient(),
    request,
  };
}

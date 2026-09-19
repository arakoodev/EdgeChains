import { beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

function createFetchMock(result: any = { result: true }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(result),
  });
}

describe("Qdrant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a collection with vector configuration", async () => {
    const fetchMock = createFetchMock();
    const qdrant = new Qdrant("http://localhost:6333", "test-key", fetchMock);
    const client = qdrant.createClient();

    await qdrant.createCollection({
      client,
      tableName: "documents",
      vectorSize: 1536,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections/documents",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "api-key": "test-key" }),
        body: JSON.stringify({ vectors: { size: 1536, distance: "Cosine" } }),
      }),
    );
  });

  it("upserts vector data with payload using the REST API", async () => {
    const fetchMock = createFetchMock();
    const qdrant = new Qdrant("http://localhost:6333", undefined, fetchMock);
    const client = qdrant.createClient();

    await qdrant.insertVectorData({
      client,
      tableName: "documents",
      id: 1,
      content: "hello",
      embedding: [0.1, 0.2, 0.3],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections/documents/points",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          points: [
            {
              id: 1,
              vector: [0.1, 0.2, 0.3],
              payload: { content: "hello" },
            },
          ],
        }),
      }),
    );
  });

  it("searches points from an embedding", async () => {
    const fetchMock = createFetchMock({ result: [{ id: 1, score: 0.99 }] });
    const qdrant = new Qdrant("http://localhost:6333", undefined, fetchMock);
    const client = qdrant.createClient();

    const result = await qdrant.getDataFromQuery({
      client,
      tableName: "documents",
      embedding: [0.1, 0.2, 0.3],
      limit: 3,
    });

    expect(result).toEqual({ result: [{ id: 1, score: 0.99 }] });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections/documents/points/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          vector: [0.1, 0.2, 0.3],
          limit: 3,
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
  });

  it("retrieves, updates, and deletes points by id", async () => {
    const fetchMock = createFetchMock();
    const qdrant = new Qdrant("http://localhost:6333", undefined, fetchMock);
    const client = qdrant.createClient();

    await qdrant.getDataById({ client, tableName: "documents", id: "doc-1" });
    await qdrant.updateById({
      client,
      tableName: "documents",
      id: "doc-1",
      updatedContent: { source: "manual" },
    });
    await qdrant.deleteById({ client, tableName: "documents", id: "doc-1" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:6333/collections/documents/points",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          ids: ["doc-1"],
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:6333/collections/documents/points/payload",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          payload: { source: "manual" },
          points: ["doc-1"],
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:6333/collections/documents/points/delete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ points: ["doc-1"] }),
      }),
    );
  });

  it("throws a useful error when Qdrant returns an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ status: { error: "bad vector" } }),
    });
    const qdrant = new Qdrant("http://localhost:6333", undefined, fetchMock);
    const client = qdrant.createClient();

    await expect(
      qdrant.getDataFromQuery({
        client,
        tableName: "documents",
        vector: [0.1],
      }),
    ).rejects.toThrow("Qdrant request failed with status 400");
  });
});

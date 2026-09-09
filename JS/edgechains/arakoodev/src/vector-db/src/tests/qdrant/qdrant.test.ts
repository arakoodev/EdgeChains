import { describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant";

const createResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

describe("Qdrant", () => {
  it("creates collections through the REST API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createResponse({ result: true }));
    const qdrant = new Qdrant(
      "https://qdrant.example",
      "secret",
      fetchMock as any,
    );
    const client = qdrant.createClient();

    await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectorSize: 1536,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "api-key": "secret",
        }),
        body: JSON.stringify({
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        }),
      }),
    );
  });

  it("upserts vector points using existing insertVectorData shape", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createResponse({ status: "ok" }));
    const qdrant = new Qdrant(
      "https://qdrant.example",
      undefined,
      fetchMock as any,
    );
    const client = qdrant.createClient();

    await qdrant.insertVectorData({
      client,
      tableName: "documents",
      id: 42,
      content: "hello",
      embedding: [0.1, 0.2, 0.3],
      source: "unit-test",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents/points",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          points: [
            {
              id: 42,
              vector: [0.1, 0.2, 0.3],
              payload: {
                content: "hello",
                source: "unit-test",
              },
            },
          ],
        }),
      }),
    );
  });

  it("searches points from an embedding", async () => {
    const response = { result: [{ id: 1, score: 0.98 }] };
    const fetchMock = vi.fn().mockResolvedValue(createResponse(response));
    const qdrant = new Qdrant(
      "https://qdrant.example",
      undefined,
      fetchMock as any,
    );
    const client = qdrant.createClient();

    const result = await qdrant.getDataFromQuery({
      client,
      collectionName: "documents",
      embedding: [0.5, 0.6],
      limit: 3,
      filter: { must: [{ key: "type", match: { value: "note" } }] },
    });

    expect(result).toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents/points/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          vector: [0.5, 0.6],
          limit: 3,
          filter: { must: [{ key: "type", match: { value: "note" } }] },
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
  });

  it("retrieves, updates, and deletes by id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createResponse({ result: true }));
    const qdrant = new Qdrant(
      "https://qdrant.example",
      undefined,
      fetchMock as any,
    );
    const client = qdrant.createClient();

    await qdrant.getDataById({ client, tableName: "documents", id: "abc" });
    await qdrant.updateById({
      client,
      tableName: "documents",
      id: "abc",
      updatedContent: { content: "redacted" },
    });
    await qdrant.deleteById({ client, tableName: "documents", id: "abc" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://qdrant.example/collections/documents/points",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          ids: ["abc"],
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://qdrant.example/collections/documents/points/payload",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          points: ["abc"],
          payload: { content: "redacted" },
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://qdrant.example/collections/documents/points/delete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          points: ["abc"],
        }),
      }),
    );
  });

  it("throws readable errors when Qdrant returns a non-2xx response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createResponse({ status: { error: "bad vector" } }, false, 400),
      );
    const qdrant = new Qdrant(
      "https://qdrant.example",
      undefined,
      fetchMock as any,
    );
    const client = qdrant.createClient();

    await expect(
      qdrant.getDataFromQuery({
        client,
        tableName: "documents",
        embedding: [1],
      }),
    ).rejects.toThrow("Qdrant request failed with status 400");
  });
});

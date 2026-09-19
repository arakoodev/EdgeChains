import { beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

const makeResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

describe("Qdrant vector database client", () => {
  let fetcher: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetcher = vi.fn(async () => makeResponse({ result: "ok" }));
  });

  it("creates collections through the REST API without a Qdrant package", async () => {
    const qdrant = new Qdrant("https://qdrant.local/", "secret", {
      fetcher: fetcher as unknown as typeof fetch,
    });

    await qdrant.createCollection({
      collectionName: "documents",
      vectorSize: 1536,
      distance: "Dot",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://qdrant.local/collections/documents",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "api-key": "secret",
        }),
        body: JSON.stringify({
          vectors: {
            size: 1536,
            distance: "Dot",
          },
        }),
      }),
    );
  });

  it("upserts one vector using the existing tableName-style argument", async () => {
    const qdrant = new Qdrant("https://qdrant.local", undefined, {
      fetcher: fetcher as unknown as typeof fetch,
    });

    await qdrant.insertVectorData({
      tableName: "chunks",
      id: "chunk-1",
      vector: [0.1, 0.2],
      payload: {
        text: "hello",
      },
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://qdrant.local/collections/chunks/points?wait=true",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          points: [
            {
              id: "chunk-1",
              vector: [0.1, 0.2],
              payload: {
                text: "hello",
              },
            },
          ],
        }),
      }),
    );
  });

  it("searches with Qdrant filter and payload options", async () => {
    const qdrant = new Qdrant("https://qdrant.local", "", {
      fetcher: fetcher as unknown as typeof fetch,
    });

    await qdrant.getDataFromQuery({
      collectionName: "chunks",
      vector: [0.3, 0.4],
      limit: 3,
      filter: {
        must: [{ key: "source", match: { value: "docs" } }],
      },
      withVector: true,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://qdrant.local/collections/chunks/points/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          vector: [0.3, 0.4],
          limit: 3,
          filter: {
            must: [{ key: "source", match: { value: "docs" } }],
          },
          with_payload: true,
          with_vector: true,
        }),
      }),
    );
  });

  it("retrieves and deletes points by id", async () => {
    const qdrant = new Qdrant("https://qdrant.local", "", {
      fetcher: fetcher as unknown as typeof fetch,
    });

    await qdrant.getDataById({
      tableName: "chunks",
      id: 42,
      withPayload: false,
    });
    await qdrant.deleteById({
      tableName: "chunks",
      id: 42,
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://qdrant.local/collections/chunks/points",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          ids: [42],
          with_payload: false,
          with_vector: false,
        }),
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://qdrant.local/collections/chunks/points/delete?wait=true",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          points: [42],
        }),
      }),
    );
  });

  it("surfaces Qdrant API errors with response context", async () => {
    fetcher = vi.fn(async () =>
      makeResponse({ status: { error: "bad vector" } }, false, 400),
    );
    const qdrant = new Qdrant("https://qdrant.local", "", {
      fetcher: fetcher as unknown as typeof fetch,
    });

    await expect(
      qdrant.insertVectorData({
        tableName: "chunks",
        id: "bad",
        vector: [1],
      }),
    ).rejects.toThrow("Qdrant request failed with 400");
  });
});

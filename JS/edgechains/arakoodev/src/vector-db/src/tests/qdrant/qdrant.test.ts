import { Qdrant } from "../../lib/qdrant/qdrant";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();

global.fetch = mockFetch as any;

describe("Qdrant", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: { status: "ok" } }),
    });
  });

  it("upserts vector points through the Qdrant REST API", async () => {
    const qdrant = new Qdrant("https://qdrant.example", "secret-key");

    const result = await qdrant.insertVectorData({
      collectionName: "documents",
      points: [
        {
          id: "doc-1",
          vector: [0.1, 0.2, 0.3],
          payload: { content: "hello" },
        },
      ],
    });

    expect(result).toEqual({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents/points?wait=true",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "api-key": "secret-key",
        },
        body: JSON.stringify({
          points: [
            {
              id: "doc-1",
              vector: [0.1, 0.2, 0.3],
              payload: { content: "hello" },
            },
          ],
        }),
      },
    );
  });

  it("searches a collection with vector query options", async () => {
    const qdrant = new Qdrant("https://qdrant.example/");

    await qdrant.getDataFromQuery({
      collectionName: "documents",
      vector: [0.1, 0.2, 0.3],
      limit: 3,
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
      withVector: true,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents/points/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          vector: [0.1, 0.2, 0.3],
          limit: 3,
          filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
          with_payload: true,
          with_vector: true,
        }),
      }),
    );
  });

  it("throws a useful error when Qdrant returns a non-2xx response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ status: { error: "Not found" } }),
    });
    const qdrant = new Qdrant("https://qdrant.example");

    await expect(
      qdrant.getDataById({
        collectionName: "documents",
        ids: ["missing"],
      }),
    ).rejects.toThrow("Qdrant request failed with status 404");
  });
});

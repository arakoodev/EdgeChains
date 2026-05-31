import { Qdrant } from "../../lib/qdrant/qdrant";

const mockFetch = jest.fn();

describe("Qdrant vector database client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: "ok" }),
    });
    global.fetch = mockFetch;
  });

  it("creates collections with direct REST calls and api-key auth", async () => {
    const qdrant = new Qdrant("https://qdrant.example/", "secret");

    await qdrant.createCollection("docs", {
      vectors: { size: 1536, distance: "Cosine" },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://qdrant.example/collections/docs",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "api-key": "secret",
        },
        body: JSON.stringify({ vectors: { size: 1536, distance: "Cosine" } }),
      },
    );
  });

  it("upserts and searches points without qdrant packages", async () => {
    const qdrant = new Qdrant("https://qdrant.example");

    await qdrant.upsertPoints("docs", [
      {
        id: 1,
        vector: [0.1, 0.2, 0.3],
        payload: { text: "hello" },
      },
    ]);
    await qdrant.search({
      collectionName: "docs",
      vector: [0.1, 0.2, 0.3],
      limit: 3,
      filter: { must: [{ key: "kind", match: { value: "note" } }] },
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://qdrant.example/collections/docs/points",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          points: [
            { id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "hello" } },
          ],
        }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://qdrant.example/collections/docs/points/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          vector: [0.1, 0.2, 0.3],
          limit: 3,
          filter: { must: [{ key: "kind", match: { value: "note" } }] },
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
  });

  it("throws a useful error when Qdrant returns a failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ status: { error: "not found" } }),
    });
    const qdrant = new Qdrant("https://qdrant.example");

    await expect(qdrant.deleteCollection("missing")).rejects.toThrow(
      "Qdrant request failed with status 404",
    );
  });
});

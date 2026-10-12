import { Qdrant } from "../../lib/qdrant/qdrant";

describe("Qdrant", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: "ok" }),
    });
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("creates a collection using the Qdrant REST API", async () => {
    const qdrant = new Qdrant("https://qdrant.example.com", "api-key");

    await qdrant.createCollection({
      collectionName: "documents",
      vectorSize: 1536,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example.com/collections/documents",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "api-key": "api-key" }),
        body: JSON.stringify({
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        }),
      }),
    );
  });

  test("inserts points without using the qdrant package", async () => {
    const qdrant = new Qdrant("https://qdrant.example.com");

    await qdrant.insertVectorData({
      collectionName: "documents",
      points: [
        {
          id: 1,
          vector: [0.1, 0.2],
          payload: { raw_text: "hello" },
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example.com/collections/documents/points?wait=true",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          points: [
            {
              id: 1,
              vector: [0.1, 0.2],
              payload: { raw_text: "hello" },
            },
          ],
        }),
      }),
    );
  });

  test("searches points using vector and filter payload", async () => {
    const qdrant = new Qdrant("https://qdrant.example.com");

    await qdrant.searchVectorData({
      collectionName: "documents",
      vector: [0.1, 0.2],
      limit: 3,
      filter: {
        must: [{ key: "namespace", match: { value: "docs" } }],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example.com/collections/documents/points/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          vector: [0.1, 0.2],
          limit: 3,
          filter: {
            must: [{ key: "namespace", match: { value: "docs" } }],
          },
          with_payload: true,
        }),
      }),
    );
  });
});

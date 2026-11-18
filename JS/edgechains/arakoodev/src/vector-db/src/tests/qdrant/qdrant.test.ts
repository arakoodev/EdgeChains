import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "https://mock-qdrant.example";

describe("Qdrant", () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: "ok", status: "ok" }),
    })) as jest.Mock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should create a collection", async () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

    const result = await qdrant.createCollection({
      collectionName: "documents",
      vectors: { size: 1536, distance: "Cosine" },
    });

    expect(result).toEqual({ result: "ok", status: "ok" });
    expect(global.fetch).toHaveBeenCalledWith(
      `${MOCK_QDRANT_URL}/collections/documents`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ vectors: { size: 1536, distance: "Cosine" } }),
      }),
    );
  });

  it("should upsert vector points", async () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

    await qdrant.upsertPoints({
      collectionName: "documents",
      points: [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3],
          payload: { content: "hello" },
        },
      ],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${MOCK_QDRANT_URL}/collections/documents/points?wait=true`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          points: [
            { id: 1, vector: [0.1, 0.2, 0.3], payload: { content: "hello" } },
          ],
        }),
      }),
    );
  });

  it("should search vector points", async () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

    await qdrant.searchPoints({
      collectionName: "documents",
      vector: [0.1, 0.2, 0.3],
      limit: 5,
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${MOCK_QDRANT_URL}/collections/documents/points/search`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          vector: [0.1, 0.2, 0.3],
          limit: 5,
          filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
  });

  it("should delete vector points", async () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

    await qdrant.deletePoints({ collectionName: "documents", points: [1, 2] });

    expect(global.fetch).toHaveBeenCalledWith(
      `${MOCK_QDRANT_URL}/collections/documents/points/delete?wait=true`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ points: [1, 2] }),
      }),
    );
  });
});

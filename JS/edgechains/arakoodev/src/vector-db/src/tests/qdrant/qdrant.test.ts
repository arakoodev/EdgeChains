import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "https://mock-qdrant.local";
const MOCK_QDRANT_API_KEY = "mock-api-key";

describe("Qdrant vector database client", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({ result: "ok" })),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("creates a client from constructor arguments", () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

    expect(qdrant.createClient()).toEqual({
      url: MOCK_QDRANT_URL,
      apiKey: MOCK_QDRANT_API_KEY,
    });
  });

  it("creates a collection with vector configuration", async () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectorSize: 1536,
    });

    expect(fetch).toHaveBeenCalledWith(
      `${MOCK_QDRANT_URL}/collections/documents`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "api-key": MOCK_QDRANT_API_KEY,
        },
        body: JSON.stringify({
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        }),
      },
    );
  });

  it("upserts vector points", async () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();
    const points = [
      {
        id: 1,
        vector: [0.1, 0.2, 0.3],
        payload: { content: "hello" },
      },
    ];

    await qdrant.insertVectorData({
      client,
      collectionName: "documents",
      points,
    });

    expect(fetch).toHaveBeenCalledWith(
      `${MOCK_QDRANT_URL}/collections/documents/points?wait=true`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ points }),
      }),
    );
  });

  it("searches a collection", async () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.search({
      client,
      collectionName: "documents",
      vector: [0.1, 0.2, 0.3],
      limit: 3,
    });

    expect(fetch).toHaveBeenCalledWith(
      `${MOCK_QDRANT_URL}/collections/documents/points/search`,
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

  it("throws when Qdrant returns an error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ status: { error: "bad vector" } })),
    }) as jest.Mock;

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY, {
      retries: 0,
    });

    await expect(
      qdrant.search({
        client: qdrant.createClient(),
        collectionName: "documents",
        vector: [0.1],
      }),
    ).rejects.toThrow("Qdrant request failed: bad vector");
  });
});

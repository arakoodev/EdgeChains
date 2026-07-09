import { Qdrant } from "../../lib/qdrant/qdrant";

const createMockClient = () =>
  ({
    put: jest.fn().mockResolvedValue({ data: { status: "ok", result: true } }),
    post: jest.fn().mockResolvedValue({ data: { status: "ok", result: [] } }),
    get: jest
      .fn()
      .mockResolvedValue({ data: { status: "ok", result: { id: 1 } } }),
    delete: jest
      .fn()
      .mockResolvedValue({ data: { status: "ok", result: true } }),
  }) as any;

describe("Qdrant", () => {
  it("creates a collection with vector settings", async () => {
    const client = createMockClient();
    const qdrant = new Qdrant("http://localhost:6333", "test-key");

    const result = await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectorSize: 1536,
      distance: "Cosine",
    });

    expect(result).toEqual({ status: "ok", result: true });
    expect(client.put).toHaveBeenCalledWith(
      "/collections/documents",
      { vectors: { size: 1536, distance: "Cosine" } },
      { params: {} },
    );
  });

  it("upserts vector points through the Qdrant REST API", async () => {
    const client = createMockClient();
    const qdrant = new Qdrant("http://localhost:6333", "test-key");

    await qdrant.insertVectorData({
      client,
      collectionName: "documents",
      id: "doc-1",
      vector: [0.1, 0.2, 0.3],
      payload: { content: "hello qdrant" },
      wait: true,
    });

    expect(client.put).toHaveBeenCalledWith(
      "/collections/documents/points",
      {
        points: [
          {
            id: "doc-1",
            vector: [0.1, 0.2, 0.3],
            payload: { content: "hello qdrant" },
          },
        ],
      },
      { params: { wait: true } },
    );
  });

  it("queries points using the universal query endpoint", async () => {
    const client = createMockClient();
    const qdrant = new Qdrant("http://localhost:6333", "test-key");

    await qdrant.queryVectorData({
      client,
      collectionName: "documents",
      query: [0.1, 0.2, 0.3],
      filter: { must: [{ key: "source", match: { value: "pdf" } }] },
      limit: 3,
      withPayload: true,
    });

    expect(client.post).toHaveBeenCalledWith(
      "/collections/documents/points/query",
      {
        query: [0.1, 0.2, 0.3],
        filter: { must: [{ key: "source", match: { value: "pdf" } }] },
        limit: 3,
        with_payload: true,
        with_vector: false,
      },
      { params: {} },
    );
  });

  it("keeps a search helper for older Qdrant search integrations", async () => {
    const client = createMockClient();
    const qdrant = new Qdrant("http://localhost:6333", "test-key");

    await qdrant.searchVectorData({
      client,
      collectionName: "documents",
      vector: [0.1, 0.2, 0.3],
      limit: 5,
      scoreThreshold: 0.75,
    });

    expect(client.post).toHaveBeenCalledWith(
      "/collections/documents/points/search",
      {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        with_payload: true,
        with_vector: false,
        score_threshold: 0.75,
      },
      { params: {} },
    );
  });

  it("retrieves and deletes points by id", async () => {
    const client = createMockClient();
    const qdrant = new Qdrant("http://localhost:6333", "test-key");

    await qdrant.getDataById({
      client,
      collectionName: "documents",
      id: "doc-1",
    });
    await qdrant.deleteById({
      client,
      collectionName: "documents",
      ids: ["doc-1", "doc-2"],
      wait: true,
    });

    expect(client.get).toHaveBeenCalledWith(
      "/collections/documents/points/doc-1",
      {
        params: {},
      },
    );
    expect(client.post).toHaveBeenCalledWith(
      "/collections/documents/points/delete",
      { points: ["doc-1", "doc-2"] },
      { params: { wait: true } },
    );
  });
});

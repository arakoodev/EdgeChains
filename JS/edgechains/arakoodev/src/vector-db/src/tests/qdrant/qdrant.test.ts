import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const createHttpClient = () => ({
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
});

describe("Qdrant", () => {
  it("creates a collection with the configured vector size", async () => {
    const httpClient = createHttpClient();
    httpClient.put.mockResolvedValue({ data: { result: true } });
    const qdrant = new Qdrant({ url: "http://localhost:6333/", httpClient });

    const result = await qdrant.createCollection({
      collectionName: "documents",
      vectorSize: 1536,
      distance: "Cosine",
    });

    expect(result).toEqual({ result: true });
    expect(httpClient.put).toHaveBeenCalledWith("/collections/documents", {
      vectors: { size: 1536, distance: "Cosine" },
    });
  });

  it("upserts vector points directly through the Qdrant REST API", async () => {
    const httpClient = createHttpClient();
    httpClient.put.mockResolvedValue({ data: { status: "ok" } });
    const qdrant = new Qdrant({ httpClient });

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
    expect(httpClient.put).toHaveBeenCalledWith(
      "/collections/documents/points?wait=true",
      {
        points: [
          {
            id: "doc-1",
            vector: [0.1, 0.2, 0.3],
            payload: { content: "hello" },
          },
        ],
      },
    );
  });

  it("queries points with payloads by default", async () => {
    const httpClient = createHttpClient();
    httpClient.post.mockResolvedValue({
      data: {
        result: {
          points: [{ id: "doc-1", score: 0.9, payload: { content: "hello" } }],
        },
      },
    });
    const qdrant = new Qdrant({ httpClient });

    const result = await qdrant.queryPoints({
      collectionName: "documents",
      query: [0.1, 0.2, 0.3],
      limit: 3,
    });

    expect(result.result.points[0].id).toBe("doc-1");
    expect(httpClient.post).toHaveBeenCalledWith(
      "/collections/documents/points/query",
      {
        query: [0.1, 0.2, 0.3],
        limit: 3,
        with_payload: true,
        with_vector: false,
      },
    );
  });

  it("deletes points by id", async () => {
    const httpClient = createHttpClient();
    httpClient.post.mockResolvedValue({ data: { status: "acknowledged" } });
    const qdrant = new Qdrant({ httpClient });

    const result = await qdrant.deleteById({
      collectionName: "documents",
      ids: ["doc-1", "doc-2"],
    });

    expect(result).toEqual({ status: "acknowledged" });
    expect(httpClient.post).toHaveBeenCalledWith(
      "/collections/documents/points/delete?wait=true",
      {
        points: ["doc-1", "doc-2"],
      },
    );
  });
});

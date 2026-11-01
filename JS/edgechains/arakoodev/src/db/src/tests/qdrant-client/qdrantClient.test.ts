import axios from "axios";
import {
  QdrantClient,
  QdrantDistanceMetric,
} from "../../../../../dist/db/src/lib/qdrant-client/QdrantClient.js";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("QdrantClient", () => {
  let mockPost: jest.Mock;
  let mockPut: jest.Mock;
  let mockDelete: jest.Mock;
  let mockGet: jest.Mock;

  beforeEach(() => {
    mockPost = jest.fn();
    mockPut = jest.fn();
    mockDelete = jest.fn();
    mockGet = jest.fn();

    mockedAxios.create.mockReturnValue({
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      get: mockGet,
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should initialize with default config and correct base URL", () => {
    const client = new QdrantClient(
      [[0.1, 0.2, 0.3]],
      QdrantDistanceMetric.COSINE,
      5,
      "knowledge_base",
    );

    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://localhost:6333",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(client.topK).toBe(5);
    expect(client.collectionName).toBe("knowledge_base");
  });

  test("dbQuery should send search request and format returned points", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        result: [
          {
            id: "doc-1",
            score: 0.95,
            payload: {
              raw_text: "Qdrant vector integration for EdgeChains",
              filename: "guide.txt",
              timestamp: 1700000000,
            },
          },
          {
            id: "doc-2",
            score: 0.88,
            payload: {
              raw_text: "Second retrieved document",
              filename: "faq.txt",
            },
          },
        ],
      },
    });

    const client = new QdrantClient(
      [[0.1, 0.2, 0.3]],
      QdrantDistanceMetric.COSINE,
      10,
      "test_collection",
      "production",
    );

    const results = await client.dbQuery();

    expect(mockPost).toHaveBeenCalledWith(
      "/collections/test_collection/points/search",
      expect.objectContaining({
        vector: [0.1, 0.2, 0.3],
        limit: 10,
        with_payload: true,
        filter: {
          must: [{ key: "namespace", match: { value: "production" } }],
        },
      }),
    );

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("doc-1");
    expect(results[0].score).toBe(0.95);
    expect(results[0].raw_text).toBe(
      "Qdrant vector integration for EdgeChains",
    );
    expect(results[0].filename).toBe("guide.txt");
  });

  test("upsert should call Qdrant points endpoint with payload", async () => {
    mockPut.mockResolvedValueOnce({ data: { status: "ok" } });

    const client = new QdrantClient(
      [],
      QdrantDistanceMetric.COSINE,
      5,
      "products",
    );

    const points = [
      { id: 1, vector: [0.5, 0.5], payload: { title: "Item A" } },
    ];

    const res = await client.upsert(points);
    expect(mockPut).toHaveBeenCalledWith("/collections/products/points", {
      points,
    });
    expect(res).toEqual({ status: "ok" });
  });

  test("createCollection should send correct vector dimensions and distance", async () => {
    mockPut.mockResolvedValueOnce({ data: { result: true } });

    const client = new QdrantClient(
      [],
      QdrantDistanceMetric.DOT,
      10,
      "embeddings_1536",
    );

    await client.createCollection(1536, QdrantDistanceMetric.DOT);

    expect(mockPut).toHaveBeenCalledWith("/collections/embeddings_1536", {
      vectors: {
        size: 1536,
        distance: "Dot",
      },
    });
  });

  test("deleteCollection should send DELETE request to collection URL", async () => {
    mockDelete.mockResolvedValueOnce({ data: { result: true } });

    const client = new QdrantClient(
      [],
      QdrantDistanceMetric.COSINE,
      10,
      "old_collection",
    );

    await client.deleteCollection();

    expect(mockDelete).toHaveBeenCalledWith("/collections/old_collection");
  });
});

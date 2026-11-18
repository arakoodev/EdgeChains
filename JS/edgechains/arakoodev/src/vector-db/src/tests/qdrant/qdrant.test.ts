import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Qdrant Vector DB", () => {
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

  test("should initialize with default Qdrant endpoint", () => {
    new Qdrant();
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://localhost:6333",
      }),
    );
  });

  test("search should execute vector search query with retry support", async () => {
    const mockHits = [{ id: 1, score: 0.92, payload: { text: "hello" } }];
    mockPost.mockResolvedValueOnce({ data: { result: mockHits } });

    const qdrant = new Qdrant();
    const results = await qdrant.search({
      collectionName: "test_docs",
      vector: [0.1, 0.2, 0.3],
      limit: 5,
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/collections/test_docs/points/search",
      expect.objectContaining({
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        with_payload: true,
      }),
    );
    expect(results).toEqual(mockHits);
  });

  test("insertVectorData should upsert points into collection", async () => {
    mockPut.mockResolvedValueOnce({ data: { status: "ok" } });

    const qdrant = new Qdrant();
    const res = await qdrant.insertVectorData({
      collectionName: "my_collection",
      points: [{ id: 1, vector: [0.1, 0.2], payload: { label: "doc1" } }],
    });

    expect(mockPut).toHaveBeenCalledWith("/collections/my_collection/points", {
      points: [{ id: 1, vector: [0.1, 0.2], payload: { label: "doc1" } }],
    });
    expect(res).toEqual({ status: "ok" });
  });

  test("createCollection should create collection with specified dimension", async () => {
    mockPut.mockResolvedValueOnce({ data: { result: true } });

    const qdrant = new Qdrant();
    const res = await qdrant.createCollection({
      collectionName: "custom_coll",
      vectorSize: 768,
      distance: "Cosine",
    });

    expect(mockPut).toHaveBeenCalledWith("/collections/custom_coll", {
      vectors: {
        size: 768,
        distance: "Cosine",
      },
    });
    expect(res).toEqual({ result: true });
  });

  test("deleteById should send deletion request for point ID", async () => {
    mockPost.mockResolvedValueOnce({ data: { status: "ok" } });

    const qdrant = new Qdrant();
    await qdrant.deleteById({
      collectionName: "coll",
      id: 42,
    });

    expect(mockPost).toHaveBeenCalledWith("/collections/coll/points/delete", {
      points: [42],
    });
  });
});

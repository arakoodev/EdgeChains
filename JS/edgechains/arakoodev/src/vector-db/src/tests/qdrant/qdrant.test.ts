import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

// Mock the Qdrant class
jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
  return {
    Qdrant: jest.fn().mockImplementation((QDRANT_URL, QDRANT_API_KEY) => ({
      QDRANT_URL,
      QDRANT_API_KEY,
      createClient: jest.fn(),
      createCollection: jest
        .fn()
        .mockImplementation(async ({ collectionName }) => ({
          result: { name: collectionName },
        })),
      upsertPoints: jest.fn().mockImplementation(async () => ({
        result: { status: "completed" },
      })),
      search: jest
        .fn()
        .mockImplementation(
          async ({ collectionName, vector, limit, withPayload = true }) => ({
            collectionName,
            vector,
            limit,
            withPayload,
            hits: [{ id: 1, score: 0.99 }],
          }),
        ),
      deleteByIds: jest.fn().mockImplementation(async () => ({
        result: { status: "completed" },
      })),
    })),
  };
});

describe("Qdrant", () => {
  const qdrant = new Qdrant("https://mock-qdrant.io", "mock-api-key");
  const client = qdrant.createClient();

  test("constructor should store url and api key", () => {
    expect(qdrant.QDRANT_URL).toBe("https://mock-qdrant.io");
    expect(qdrant.QDRANT_API_KEY).toBe("mock-api-key");
  });

  test("createCollection should create a collection", async () => {
    const res = await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectors: { size: 1536, distance: "Cosine" },
    });
    expect(res.result.name).toBe("documents");
    expect(qdrant.createCollection).toHaveBeenCalledWith({
      client,
      collectionName: "documents",
      vectors: { size: 1536, distance: "Cosine" },
    });
  });

  test("upsertPoints should upsert points", async () => {
    const res = await qdrant.upsertPoints({
      client,
      collectionName: "documents",
      points: [{ id: 1, vector: [0.1, 0.2], payload: { text: "hello" } }],
    });
    expect(res.result.status).toBe("completed");
  });

  test("search should return matched points", async () => {
    const res = await qdrant.search({
      client,
      collectionName: "documents",
      vector: [0.1, 0.2],
      limit: 5,
    });
    expect(res.collectionName).toBe("documents");
    expect(res.hits[0].id).toBe(1);
  });

  test("deleteByIds should delete points by id", async () => {
    const res = await qdrant.deleteByIds({
      client,
      collectionName: "documents",
      ids: [1],
    });
    expect(res.result.status).toBe("completed");
  });
});

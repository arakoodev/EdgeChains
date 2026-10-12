import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Qdrant", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.request.mockResolvedValue({ data: { status: "ok" } });
  });

  it("creates a collection using the Qdrant REST API", async () => {
    const qdrant = new Qdrant("http://localhost:6333", "mock-api-key");
    const client = qdrant.createClient();

    const result = await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectorSize: 1536,
    });

    expect(result).toEqual({ status: "ok" });
    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: "http://localhost:6333/collections/documents",
        data: {
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        },
        headers: expect.objectContaining({
          "api-key": "mock-api-key",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("upserts vector points without the Qdrant package", async () => {
    const qdrant = new Qdrant("http://localhost:6333");

    await qdrant.insertVectorData({
      collectionName: "documents",
      points: [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3],
          payload: { content: "hello" },
        },
      ],
      wait: true,
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: "http://localhost:6333/collections/documents/points",
        params: { wait: true, ordering: undefined },
        data: {
          points: [
            {
              id: 1,
              vector: [0.1, 0.2, 0.3],
              payload: { content: "hello" },
            },
          ],
        },
      }),
    );
  });

  it("queries vector points", async () => {
    const qdrant = new Qdrant("http://localhost:6333");

    await qdrant.queryVectorData({
      collectionName: "documents",
      query: [0.1, 0.2, 0.3],
      limit: 5,
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "http://localhost:6333/collections/documents/points/query",
        data: expect.objectContaining({
          query: [0.1, 0.2, 0.3],
          limit: 5,
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
  });

  it("deletes points by id", async () => {
    const qdrant = new Qdrant("http://localhost:6333");

    await qdrant.deleteById({
      collectionName: "documents",
      ids: [1, "5c56c793-69f3-4fbf-87e6-c4bf54c28c26"],
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "http://localhost:6333/collections/documents/points/delete",
        data: {
          points: [1, "5c56c793-69f3-4fbf-87e6-c4bf54c28c26"],
        },
      }),
    );
  });
});

import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

jest.mock("axios", () => ({
  create: jest.fn(),
}));

const client = {
  put: jest.fn(),
  post: jest.fn(),
  get: jest.fn(),
};

describe("Qdrant", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(client);
    client.put.mockResolvedValue({ data: { status: "ok" } });
    client.post.mockResolvedValue({ data: { result: [] } });
    client.get.mockResolvedValue({ data: { result: { id: 1 } } });
  });

  it("creates an axios client with Qdrant credentials", () => {
    const qdrant = new Qdrant("https://qdrant.example", "secret-key");

    expect(qdrant.createClient()).toBe(client);
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: "https://qdrant.example",
      headers: { "api-key": "secret-key" },
    });
  });

  it("creates a collection with a default vector config", async () => {
    const qdrant = new Qdrant("https://qdrant.example");

    await qdrant.createCollection({
      client: client as any,
      collectionName: "docs",
      vectorSize: 1536,
    });

    expect(client.put).toHaveBeenCalledWith("/collections/docs", {
      vectors: { size: 1536, distance: "Cosine" },
    });
  });

  it("upserts a single point through the REST API", async () => {
    const qdrant = new Qdrant("https://qdrant.example");

    await qdrant.insertVectorData({
      client: client as any,
      collectionName: "docs",
      id: 1,
      vector: [0.1, 0.2],
      payload: { text: "hello" },
    });

    expect(client.put).toHaveBeenCalledWith(
      "/collections/docs/points",
      { points: [{ id: 1, vector: [0.1, 0.2], payload: { text: "hello" } }] },
      { params: { wait: true } },
    );
  });

  it("searches points by vector", async () => {
    const qdrant = new Qdrant("https://qdrant.example");

    await qdrant.getDataFromQuery({
      client: client as any,
      collectionName: "docs",
      vector: [0.1, 0.2],
      limit: 3,
      filter: { must: [{ key: "source", match: { value: "docs" } }] },
    });

    expect(client.post).toHaveBeenCalledWith(
      "/collections/docs/points/search",
      {
        vector: [0.1, 0.2],
        limit: 3,
        filter: { must: [{ key: "source", match: { value: "docs" } }] },
        with_payload: true,
        with_vector: false,
        score_threshold: undefined,
      },
    );
  });

  it("scrolls points from a collection", async () => {
    const qdrant = new Qdrant("https://qdrant.example");

    await qdrant.getData({
      client: client as any,
      collectionName: "docs",
      limit: 5,
    });

    expect(client.post).toHaveBeenCalledWith(
      "/collections/docs/points/scroll",
      {
        limit: 5,
        offset: undefined,
        filter: undefined,
        with_payload: true,
        with_vector: false,
      },
    );
  });

  it("fetches, updates, and deletes points by id", async () => {
    const qdrant = new Qdrant("https://qdrant.example");

    await qdrant.getDataById({
      client: client as any,
      collectionName: "docs",
      id: 1,
    });
    await qdrant.updateById({
      client: client as any,
      collectionName: "docs",
      id: 1,
      updatedContent: { text: "updated" },
    });
    await qdrant.deleteById({
      client: client as any,
      collectionName: "docs",
      id: 1,
    });

    expect(client.get).toHaveBeenCalledWith("/collections/docs/points/1", {
      params: { with_payload: true, with_vector: false },
    });
    expect(client.put).toHaveBeenCalledWith(
      "/collections/docs/points/payload",
      { points: [1], payload: { text: "updated" } },
      { params: { wait: true } },
    );
    expect(client.post).toHaveBeenCalledWith(
      "/collections/docs/points/delete",
      { points: [1] },
      { params: { wait: true } },
    );
  });
});

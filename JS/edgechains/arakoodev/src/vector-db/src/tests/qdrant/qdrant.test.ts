import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const requestMock = jest.fn();

describe("Qdrant", () => {
  beforeEach(() => {
    requestMock.mockResolvedValue({ data: { result: "ok" } });
    mockedAxios.create.mockReturnValue({ request: requestMock } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("creates an axios client with api-key auth when provided", () => {
    const qdrant = new Qdrant({
      url: "https://qdrant.example.com/",
      apiKey: "test-key",
      timeout: 5000,
    });

    expect(qdrant.createClient()).toEqual({ request: requestMock });
    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: "https://qdrant.example.com",
      timeout: 5000,
      headers: {
        "content-type": "application/json",
        "api-key": "test-key",
      },
    });
  });

  it("creates a collection with vector configuration", async () => {
    const qdrant = new Qdrant({ url: "https://qdrant.example.com" });

    await qdrant.createCollection({
      collectionName: "documents",
      vectors: { size: 1536, distance: "Cosine" },
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: "put",
      url: "/collections/documents",
      data: {
        vectors: { size: 1536, distance: "Cosine" },
      },
    });
  });

  it("upserts points into a collection", async () => {
    const qdrant = new Qdrant({ url: "https://qdrant.example.com" });

    await qdrant.upsertPoints({
      collectionName: "documents",
      points: [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3],
          payload: { raw_text: "hello" },
        },
      ],
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: "put",
      url: "/collections/documents/points",
      params: { wait: true },
      data: {
        points: [
          {
            id: 1,
            vector: [0.1, 0.2, 0.3],
            payload: { raw_text: "hello" },
          },
        ],
      },
    });
  });

  it("searches points with vector and payload options", async () => {
    const qdrant = new Qdrant({ url: "https://qdrant.example.com" });

    await qdrant.search({
      collectionName: "documents",
      vector: [0.1, 0.2, 0.3],
      limit: 3,
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
      withPayload: ["raw_text", "filename"],
      scoreThreshold: 0.7,
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: "post",
      url: "/collections/documents/points/search",
      data: {
        vector: [0.1, 0.2, 0.3],
        limit: 3,
        filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
        with_payload: ["raw_text", "filename"],
        with_vector: false,
        score_threshold: 0.7,
      },
    });
  });

  it("formats named vector searches with a using value", async () => {
    const qdrant = new Qdrant({ url: "https://qdrant.example.com" });

    await qdrant.search({
      collectionName: "documents",
      vector: [0.1, 0.2, 0.3],
      using: "image-embeddings",
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: "post",
      url: "/collections/documents/points/search",
      data: {
        vector: { name: "image-embeddings", vector: [0.1, 0.2, 0.3] },
        limit: 10,
        with_payload: true,
        with_vector: false,
      },
    });
  });

  it("formats single-entry vector maps as named vector searches", async () => {
    const qdrant = new Qdrant({ url: "https://qdrant.example.com" });

    await qdrant.search({
      collectionName: "documents",
      vector: { "text-embeddings": [0.1, 0.2, 0.3] },
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: "post",
      url: "/collections/documents/points/search",
      data: {
        vector: { name: "text-embeddings", vector: [0.1, 0.2, 0.3] },
        limit: 10,
        with_payload: true,
        with_vector: false,
      },
    });
  });

  it("gets, updates, and deletes points", async () => {
    const qdrant = new Qdrant({ url: "https://qdrant.example.com" });

    await qdrant.getPoint({
      collectionName: "documents",
      id: 1,
      withPayload: false,
      withVector: true,
    });
    await qdrant.updatePayload({
      collectionName: "documents",
      ids: [1],
      payload: { filename: "example.pdf" },
    });
    await qdrant.deletePoints({ collectionName: "documents", ids: [1] });

    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: "post",
      url: "/collections/documents/points",
      data: {
        ids: [1],
        with_payload: false,
        with_vector: true,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: "post",
      url: "/collections/documents/points/payload",
      params: { wait: true },
      data: {
        payload: { filename: "example.pdf" },
        points: [1],
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, {
      method: "post",
      url: "/collections/documents/points/delete",
      params: { wait: true },
      data: {
        points: [1],
      },
    });
  });
});

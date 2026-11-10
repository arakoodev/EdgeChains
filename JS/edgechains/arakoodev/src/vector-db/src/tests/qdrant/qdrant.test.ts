import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_URL = "https://mock-qdrant.io/";
const MOCK_QDRANT_API_KEY = "mock-api-key";

function mockQdrantResponse(body: any) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(body),
  };
}

describe("Qdrant", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as any;
  });

  it("should create a qdrant client", () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    expect(client).toEqual({
      url: "https://mock-qdrant.io",
      apiKey: MOCK_QDRANT_API_KEY,
    });
  });

  it("should create a collection", async () => {
    fetchMock.mockResolvedValueOnce(
      mockQdrantResponse({ result: true, status: "ok", time: 0.001 }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    const result = await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectors: {
        size: 1536,
        distance: "Cosine",
      },
    });

    expect(result.result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://mock-qdrant.io/collections/documents"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "api-key": MOCK_QDRANT_API_KEY }),
      }),
    );
  });

  it("should insert vector data", async () => {
    fetchMock.mockResolvedValueOnce(
      mockQdrantResponse({ result: { operation_id: 1 }, status: "ok" }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    const result = await qdrant.insertVectorData({
      client,
      collectionName: "documents",
      id: 123,
      embedding: [0.1, 0.2, 0.3],
      content: "hello",
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(result.result.operation_id).toBe(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://mock-qdrant.io/collections/documents/points?wait=true",
    );
    expect(request.method).toBe("PUT");
    expect(body.points).toEqual([
      {
        id: 123,
        vector: [0.1, 0.2, 0.3],
        payload: { content: "hello" },
      },
    ]);
  });

  it("should search vector data", async () => {
    fetchMock.mockResolvedValueOnce(
      mockQdrantResponse({
        result: [{ id: 123, score: 0.9, payload: { content: "hello" } }],
        status: "ok",
      }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    const result = await qdrant.getDataFromQuery({
      client,
      tableName: "documents",
      queryVector: [0.1, 0.2, 0.3],
      limit: 1,
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(result).toEqual([
      { id: 123, score: 0.9, payload: { content: "hello" } },
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://mock-qdrant.io/collections/documents/points/search",
    );
    expect(request.method).toBe("POST");
    expect(body).toEqual(
      expect.objectContaining({
        vector: [0.1, 0.2, 0.3],
        limit: 1,
        with_payload: true,
        with_vector: false,
      }),
    );
  });

  it("should fetch data by id", async () => {
    fetchMock.mockResolvedValueOnce(
      mockQdrantResponse({
        result: [{ id: 123, payload: { content: "hello" } }],
        status: "ok",
      }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    const result = await qdrant.getDataById({
      client,
      collectionName: "documents",
      id: 123,
    });

    expect(result).toEqual({ id: 123, payload: { content: "hello" } });
  });

  it("should update payload by id", async () => {
    fetchMock.mockResolvedValueOnce(
      mockQdrantResponse({ result: { operation_id: 2 }, status: "ok" }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.updateById({
      client,
      collectionName: "documents",
      id: 123,
      updatedContent: { content: "updated" },
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://mock-qdrant.io/collections/documents/points/payload?wait=true",
    );
    expect(body).toEqual({
      points: [123],
      payload: { content: "updated" },
    });
  });

  it("should delete data by id", async () => {
    fetchMock.mockResolvedValueOnce(
      mockQdrantResponse({ result: { operation_id: 3 }, status: "ok" }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.deleteById({
      client,
      collectionName: "documents",
      id: 123,
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://mock-qdrant.io/collections/documents/points/delete?wait=true",
    );
    expect(body).toEqual({
      points: [123],
    });
  });
});

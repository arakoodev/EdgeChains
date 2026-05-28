import { Qdrant } from "../../lib/qdrant/qdrant";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_URL = "https://mock-qdrant.local";
const MOCK_QDRANT_API_KEY = "mock-api-key";

describe("Qdrant vector database client", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ result: "ok", status: "ok" }),
    })) as any;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should create a qdrant client from constructor arguments", () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

    expect(qdrant.createClient()).toEqual({
      url: MOCK_QDRANT_URL,
      apiKey: MOCK_QDRANT_API_KEY,
    });
  });

  it("should insert vector data using the qdrant points API", async () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.insertVectorData({
      client,
      collectionName: "documents",
      id: "doc-1",
      vector: [0.1, 0.2, 0.3],
      payload: { content: "hello" },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${MOCK_QDRANT_URL}/collections/documents/points?wait=true`,
      expect.objectContaining({
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "api-key": MOCK_QDRANT_API_KEY,
        },
        body: JSON.stringify({
          points: [
            {
              id: "doc-1",
              vector: [0.1, 0.2, 0.3],
              payload: { content: "hello" },
            },
          ],
        }),
      }),
    );
  });

  it("should search vector data using qdrant directly", async () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.searchVectorData({
      client,
      collectionName: "documents",
      vector: [0.1, 0.2, 0.3],
      limit: 3,
      filter: { must: [{ key: "source", match: { value: "docs" } }] },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${MOCK_QDRANT_URL}/collections/documents/points/search`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          vector: [0.1, 0.2, 0.3],
          limit: 3,
          filter: { must: [{ key: "source", match: { value: "docs" } }] },
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
  });

  it("should update and delete qdrant points by id", async () => {
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.updateById({
      client,
      collectionName: "documents",
      id: "doc-1",
      updatedContent: { content: "updated" },
    });
    await qdrant.deleteById({
      client,
      collectionName: "documents",
      id: "doc-1",
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      `${MOCK_QDRANT_URL}/collections/documents/points/payload?wait=true`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          payload: { content: "updated" },
          points: ["doc-1"],
        }),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `${MOCK_QDRANT_URL}/collections/documents/points/delete?wait=true`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          points: ["doc-1"],
        }),
      }),
    );
  });
});

import {
  Qdrant,
  QdrantVectorClient,
} from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const MOCK_QDRANT_URL = "https://mock-qdrant.local";
const MOCK_QDRANT_API_KEY = "mock-api-key";

function mockFetchResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

describe("Qdrant", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("creates a Qdrant collection with vector configuration", async () => {
    (global.fetch as any).mockImplementation(() =>
      mockFetchResponse({
        result: { operation_id: 1, status: "acknowledged" },
      }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectorSize: 1536,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://mock-qdrant.local/collections/documents?wait=true",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "api-key": MOCK_QDRANT_API_KEY,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        }),
      }),
    );
  });

  it("upserts embedding data into a Qdrant collection", async () => {
    (global.fetch as any).mockImplementation(() =>
      mockFetchResponse({
        result: { operation_id: 1, status: "acknowledged" },
      }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.insertVectorData({
      client,
      collectionName: "documents",
      id: "doc-1",
      embedding: [0.1, 0.2, 0.3],
      content: "hello qdrant",
      namespace: "docs",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://mock-qdrant.local/collections/documents/points?wait=true",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "api-key": MOCK_QDRANT_API_KEY,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          points: [
            {
              id: "doc-1",
              vector: [0.1, 0.2, 0.3],
              payload: {
                content: "hello qdrant",
                namespace: "docs",
              },
            },
          ],
        }),
      }),
    );
  });

  it("queries points with filters and returns the result points", async () => {
    const points = [
      { id: "doc-1", score: 0.91, payload: { raw_text: "hello" } },
    ];
    (global.fetch as any).mockImplementation(() =>
      mockFetchResponse({ result: { points } }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();
    const result = await qdrant.getDataFromQuery({
      client,
      collectionName: "documents",
      embedding: [0.1, 0.2, 0.3],
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
      limit: 3,
    });

    expect(result).toEqual(points);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://mock-qdrant.local/collections/documents/points/query",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          query: [0.1, 0.2, 0.3],
          limit: 3,
          with_payload: true,
          with_vector: false,
          filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
        }),
      }),
    );
  });

  it("deletes a point by id", async () => {
    (global.fetch as any).mockImplementation(() =>
      mockFetchResponse({ result: { status: "acknowledged" } }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.deleteById({
      client,
      collectionName: "documents",
      id: "doc-1",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://mock-qdrant.local/collections/documents/points/delete?wait=true",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ points: ["doc-1"] }),
      }),
    );
  });

  it("deletes a collection by name", async () => {
    (global.fetch as any).mockImplementation(() =>
      mockFetchResponse({ result: true }),
    );

    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();

    await qdrant.deleteCollection({
      client,
      collectionName: "documents",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://mock-qdrant.local/collections/documents?wait=true",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
  });
});

describe("QdrantVectorClient", () => {
  it("normalizes query results for HydeSearch style retrieval", async () => {
    const queryPoints = vi.fn().mockResolvedValue({
      result: {
        points: [
          {
            id: "doc-1",
            score: 0.91,
            payload: {
              raw_text: "retrieved text",
              namespace: "docs",
              filename: "guide.md",
            },
          },
        ],
      },
    });

    const vectorClient = new QdrantVectorClient({
      wordEmbeddings: [[0.1, 0.2, 0.3]],
      topK: 5,
      upperLimit: 2,
      collectionName: "documents",
      namespace: "docs",
      client: { queryPoints } as any,
    });

    const result = await vectorClient.dbQuery();

    expect(queryPoints).toHaveBeenCalledWith("documents", {
      query: [0.1, 0.2, 0.3],
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
      limit: 5,
      with_payload: true,
      with_vector: false,
    });
    expect(result).toEqual([
      {
        id: "doc-1",
        score: 0.91,
        raw_text: "retrieved text",
        document_date: undefined,
        metadata: undefined,
        namespace: "docs",
        filename: "guide.md",
        timestamp: undefined,
        payload: {
          raw_text: "retrieved text",
          namespace: "docs",
          filename: "guide.md",
        },
      },
    ]);
  });
});

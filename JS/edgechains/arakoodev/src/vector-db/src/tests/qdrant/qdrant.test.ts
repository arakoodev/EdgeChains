import { beforeEach, describe, expect, it, vi } from "vitest";

import { Qdrant } from "../../lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "https://qdrant.example.com";
const MOCK_QDRANT_API_KEY = "mock-api-key";

function createFetchMock(result: unknown = { ok: true }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ result }),
  });
}

function parseBody(fetchMock: ReturnType<typeof createFetchMock>) {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe("Qdrant", () => {
  let qdrant: Qdrant;

  beforeEach(() => {
    qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
  });

  it("creates collections through the Qdrant REST API", async () => {
    const fetchMock = createFetchMock({ acknowledged: true });
    const client = qdrant.createClient({ fetch: fetchMock });

    await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectorSize: 1536,
      distance: "Cosine",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example.com/collections/documents",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "api-key": MOCK_QDRANT_API_KEY,
        }),
      }),
    );
    expect(parseBody(fetchMock)).toEqual({
      vectors: {
        size: 1536,
        distance: "Cosine",
      },
    });
  });

  it("upserts vector payloads using the existing insertVectorData shape", async () => {
    const fetchMock = createFetchMock({ operation_id: 1 });
    const client = qdrant.createClient({ fetch: fetchMock });

    await qdrant.insertVectorData({
      client,
      tableName: "documents",
      id: 42,
      content: "Qdrant supports direct REST inserts",
      embedding: [0.1, 0.2, 0.3],
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://qdrant.example.com/collections/documents/points?wait=true",
    );
    expect(parseBody(fetchMock)).toEqual({
      points: [
        {
          id: 42,
          vector: [0.1, 0.2, 0.3],
          payload: {
            content: "Qdrant supports direct REST inserts",
          },
        },
      ],
    });
  });

  it("searches by vector and returns the Qdrant result payload", async () => {
    const fetchMock = createFetchMock([{ id: 7, score: 0.98 }]);
    const client = qdrant.createClient({ fetch: fetchMock });

    const result = await qdrant.getDataFromQuery({
      client,
      collectionName: "documents",
      vector: [0.4, 0.5],
      limit: 3,
      filter: { must: [{ key: "source", match: { value: "docs" } }] },
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://qdrant.example.com/collections/documents/points/search",
    );
    expect(parseBody(fetchMock)).toEqual({
      vector: [0.4, 0.5],
      limit: 3,
      filter: { must: [{ key: "source", match: { value: "docs" } }] },
      with_payload: true,
      with_vector: false,
    });
    expect(result).toEqual([{ id: 7, score: 0.98 }]);
  });

  it("scrolls collection points with payloads enabled", async () => {
    const fetchMock = createFetchMock({
      points: [{ id: 1 }],
      next_page_offset: null,
    });
    const client = qdrant.createClient({ fetch: fetchMock });

    await qdrant.getData({
      client,
      collectionName: "documents",
      limit: 2,
      filter: { must_not: [{ key: "archived", match: { value: true } }] },
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://qdrant.example.com/collections/documents/points/scroll",
    );
    expect(parseBody(fetchMock)).toEqual({
      limit: 2,
      filter: { must_not: [{ key: "archived", match: { value: true } }] },
      with_payload: true,
      with_vector: false,
    });
  });

  it("retrieves, updates, and deletes points by id", async () => {
    const fetchMock = createFetchMock({ acknowledged: true });
    const client = qdrant.createClient({ fetch: fetchMock });

    await qdrant.getDataById({ client, tableName: "documents", id: "doc-1" });
    await qdrant.updateById({
      client,
      tableName: "documents",
      id: "doc-1",
      updatedContent: { status: "reviewed" },
    });
    await qdrant.deleteById({ client, tableName: "documents", id: "doc-1" });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://qdrant.example.com/collections/documents/points",
      "https://qdrant.example.com/collections/documents/points/payload?wait=true",
      "https://qdrant.example.com/collections/documents/points/delete?wait=true",
    ]);
    expect(
      JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string),
    ).toEqual({
      payload: { status: "reviewed" },
      points: ["doc-1"],
    });
    expect(
      JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string),
    ).toEqual({
      points: ["doc-1"],
    });
  });

  it("throws a useful error when Qdrant returns a non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ status: "error", result: null }),
    });
    const client = qdrant.createClient({ fetch: fetchMock });

    await expect(
      qdrant.getDataFromQuery({
        client,
        collectionName: "documents",
        vector: [0.1, 0.2],
      }),
    ).rejects.toThrow("Qdrant request failed with status 401");
  });

  it("validates required point data before making REST calls", async () => {
    const fetchMock = createFetchMock();
    const client = qdrant.createClient({ fetch: fetchMock });

    await expect(
      qdrant.insertVectorData({
        client,
        collectionName: "documents",
        content: "missing id and vector",
      }),
    ).rejects.toThrow("id and vector or embedding are required");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

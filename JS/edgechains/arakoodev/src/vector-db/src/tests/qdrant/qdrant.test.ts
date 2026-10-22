import { describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

type FetchCall = {
  url: string;
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
};

const createMockFetch = (responseBody: any = { result: { status: "ok" } }) => {
  const calls: FetchCall[] = [];
  const fetchClient = vi.fn(async (url: string, init: FetchCall["init"]) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => responseBody,
    };
  });

  return { calls, fetchClient };
};

describe("Qdrant", () => {
  it("creates collections using direct Qdrant REST calls", async () => {
    const { calls, fetchClient } = createMockFetch();
    const qdrant = new Qdrant(
      "https://qdrant.example.com/",
      "test-key",
      fetchClient,
    );
    const client = qdrant.createClient();

    await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectorSize: 1536,
      distance: "Cosine",
    });

    expect(calls[0].url).toBe(
      "https://qdrant.example.com/collections/documents",
    );
    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].init.headers).toMatchObject({
      "Content-Type": "application/json",
      "api-key": "test-key",
    });
    expect(JSON.parse(calls[0].init.body || "{}")).toEqual({
      vectors: {
        size: 1536,
        distance: "Cosine",
      },
    });
  });

  it("upserts vector data and maps tableName to a Qdrant collection", async () => {
    const { calls, fetchClient } = createMockFetch();
    const qdrant = new Qdrant(
      "https://qdrant.example.com",
      "test-key",
      fetchClient,
    );
    const client = qdrant.createClient();

    await qdrant.insertVectorData({
      client,
      tableName: "documents",
      id: "doc-1",
      embedding: [0.1, 0.2, 0.3],
      content: "hello world",
      source: "unit-test",
    });

    expect(calls[0].url).toBe(
      "https://qdrant.example.com/collections/documents/points?wait=true",
    );
    expect(calls[0].init.method).toBe("PUT");
    expect(JSON.parse(calls[0].init.body || "{}")).toEqual({
      points: [
        {
          id: "doc-1",
          vector: [0.1, 0.2, 0.3],
          payload: {
            content: "hello world",
            source: "unit-test",
          },
        },
      ],
    });
  });

  it("searches vectors with filters and returns Qdrant results", async () => {
    const result = [
      { id: "doc-1", score: 0.98, payload: { content: "hello" } },
    ];
    const { calls, fetchClient } = createMockFetch({ result });
    const qdrant = new Qdrant(
      "https://qdrant.example.com",
      undefined,
      fetchClient,
    );
    const client = qdrant.createClient();

    const response = await qdrant.getDataFromQuery({
      client,
      collectionName: "documents",
      vector: [0.1, 0.2, 0.3],
      limit: 3,
      filter: { must: [{ key: "source", match: { value: "unit-test" } }] },
    });

    expect(response).toEqual(result);
    expect(calls[0].url).toBe(
      "https://qdrant.example.com/collections/documents/points/search",
    );
    expect(JSON.parse(calls[0].init.body || "{}")).toEqual({
      vector: [0.1, 0.2, 0.3],
      limit: 3,
      filter: { must: [{ key: "source", match: { value: "unit-test" } }] },
      with_payload: true,
      with_vector: false,
    });
  });

  it("supports scroll, retrieve, payload update, and delete helpers", async () => {
    const { calls, fetchClient } = createMockFetch({ result: [{ id: 1 }] });
    const qdrant = new Qdrant(
      "https://qdrant.example.com",
      undefined,
      fetchClient,
    );
    const client = qdrant.createClient();

    await qdrant.getData({ client, collectionName: "documents", limit: 2 });
    await qdrant.getDataById({ client, collectionName: "documents", id: 1 });
    await qdrant.updateById({
      client,
      collectionName: "documents",
      id: 1,
      updatedContent: { content: "updated" },
    });
    await qdrant.deleteById({ client, collectionName: "documents", id: 1 });

    expect(calls.map((call) => call.url)).toEqual([
      "https://qdrant.example.com/collections/documents/points/scroll",
      "https://qdrant.example.com/collections/documents/points",
      "https://qdrant.example.com/collections/documents/points/payload?wait=true",
      "https://qdrant.example.com/collections/documents/points/delete?wait=true",
    ]);
    expect(JSON.parse(calls[2].init.body || "{}")).toEqual({
      points: [1],
      payload: { content: "updated" },
    });
    expect(JSON.parse(calls[3].init.body || "{}")).toEqual({
      points: [1],
    });
  });

  it("surfaces Qdrant REST errors with response details", async () => {
    const fetchClient = vi.fn(async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({}),
      text: async () => "bad vector size",
    }));
    const qdrant = new Qdrant(
      "https://qdrant.example.com",
      undefined,
      fetchClient,
    );
    const client = qdrant.createClient();

    await expect(
      qdrant.getData({ client, collectionName: "documents" }),
    ).rejects.toThrow("bad vector size");
  });
});

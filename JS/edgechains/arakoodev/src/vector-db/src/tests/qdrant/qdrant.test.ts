import { afterEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

const createJsonResponse = (body: unknown, ok = true, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Qdrant", () => {
  it("creates a REST client with api-key headers", () => {
    const qdrant = new Qdrant(
      "https://qdrant.example.com/",
      "secret",
      "documents",
    );
    const client = qdrant.createClient();

    expect(client).toEqual({
      url: "https://qdrant.example.com",
      apiKey: "secret",
      collectionName: "documents",
      headers: {
        "Content-Type": "application/json",
        "api-key": "secret",
      },
    });
  });

  it("creates a collection using Qdrant REST API fields", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(createJsonResponse({ result: true }));
    const qdrant = new Qdrant("https://qdrant.example.com", "secret");
    const client = qdrant.createClient();

    await qdrant.createCollection({
      client,
      collectionName: "docs",
      vectorSize: 1536,
      distance: "Cosine",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example.com/collections/docs",
      {
        method: "PUT",
        headers: client.headers,
        body: JSON.stringify({
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        }),
      },
    );
  });

  it("upserts vector data without a qdrant package dependency", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(createJsonResponse({ result: { operation_id: 1 } }));
    const qdrant = new Qdrant("https://qdrant.example.com", "secret");
    const client = qdrant.createClient();

    await qdrant.insertVectorData({
      client,
      tableName: "docs",
      id: "doc-1",
      embedding: [0.1, 0.2, 0.3],
      content: "Qdrant support",
      payload: { source: "unit-test" },
      tag: "vector-db",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example.com/collections/docs/points?wait=true",
      {
        method: "PUT",
        headers: client.headers,
        body: JSON.stringify({
          points: [
            {
              id: "doc-1",
              vector: [0.1, 0.2, 0.3],
              payload: {
                source: "unit-test",
                content: "Qdrant support",
                tag: "vector-db",
              },
            },
          ],
        }),
      },
    );
  });

  it("searches vectors with filters and returns the Qdrant response", async () => {
    const responseBody = {
      result: [{ id: "doc-1", score: 0.91, payload: { content: "match" } }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse(responseBody),
    );
    const qdrant = new Qdrant("https://qdrant.example.com", "secret");
    const client = qdrant.createClient();

    const result = await qdrant.getDataFromQuery({
      client,
      tableName: "docs",
      vector: [0.4, 0.5, 0.6],
      limit: 3,
      filter: {
        must: [{ key: "source", match: { value: "unit-test" } }],
      },
    });

    expect(result).toEqual(responseBody);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://qdrant.example.com/collections/docs/points/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          vector: [0.4, 0.5, 0.6],
          limit: 3,
          filter: {
            must: [{ key: "source", match: { value: "unit-test" } }],
          },
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
  });

  it("retrieves a point by id and returns the first result", async () => {
    const point = { id: "doc-1", payload: { content: "stored" } };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({ result: [point] }),
    );
    const qdrant = new Qdrant("https://qdrant.example.com", "secret", "docs");
    const client = qdrant.createClient();

    await expect(qdrant.getDataById({ client, id: "doc-1" })).resolves.toEqual(
      point,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://qdrant.example.com/collections/docs/points",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          ids: ["doc-1"],
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
  });

  it("updates and deletes points by id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => createJsonResponse({ result: true }));
    const qdrant = new Qdrant("https://qdrant.example.com", "secret", "docs");
    const client = qdrant.createClient();

    await qdrant.updateById({
      client,
      id: "doc-1",
      updatedContent: { reviewed: true },
    });
    await qdrant.deleteById({ client, id: "doc-1" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://qdrant.example.com/collections/docs/points/payload?wait=true",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          payload: { reviewed: true },
          points: ["doc-1"],
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://qdrant.example.com/collections/docs/points/delete?wait=true",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          points: ["doc-1"],
        }),
      }),
    );
  });

  it("throws useful errors for missing vectors and Qdrant failures", async () => {
    const qdrant = new Qdrant("https://qdrant.example.com", "secret", "docs");
    const client = qdrant.createClient();

    await expect(qdrant.insertVectorData({ client })).rejects.toThrow(
      "A vector or embedding is required",
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({ status: { error: "bad request" } }, false, 400),
    );

    await expect(
      qdrant.getDataFromQuery({
        client,
        vector: [0.1, 0.2],
        tableName: "docs",
      }),
    ).rejects.toThrow("Qdrant request failed with status 400");
  });
});

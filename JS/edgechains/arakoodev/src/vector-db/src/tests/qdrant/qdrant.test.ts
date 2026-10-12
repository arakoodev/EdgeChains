import { Qdrant } from "../../lib/qdrant/qdrant";
import { describe, expect, it, vi } from "vitest";

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

describe("Qdrant", () => {
  it("creates a client from constructor values", () => {
    const fetchMock = vi.fn();
    const qdrant = new Qdrant("https://qdrant.example/", "secret", {
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(qdrant.createClient()).toEqual({
      url: "https://qdrant.example",
      apiKey: "secret",
      fetch: fetchMock,
    });
  });

  it("creates collections with Qdrant vector settings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ result: { status: "ok" } }));
    const qdrant = new Qdrant("https://qdrant.example", "secret", {
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await qdrant.createCollection({
      client: qdrant.createClient(),
      collectionName: "documents",
      vectorSize: 1536,
      distance: "Dot",
    });

    expect(result).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents",
      expect.objectContaining({
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "api-key": "secret",
        },
        body: JSON.stringify({
          vectors: {
            size: 1536,
            distance: "Dot",
          },
        }),
      }),
    );
  });

  it("upserts vector points", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ result: { operation_id: 1 } }));
    const qdrant = new Qdrant("https://qdrant.example", undefined, {
      fetch: fetchMock as unknown as typeof fetch,
    });

    await qdrant.insertVectorData({
      client: qdrant.createClient(),
      collectionName: "documents",
      id: "doc-1",
      vector: [0.1, 0.2],
      payload: { content: "hello" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents/points?wait=true",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          points: [
            {
              id: "doc-1",
              vector: [0.1, 0.2],
              payload: { content: "hello" },
            },
          ],
        }),
      }),
    );
  });

  it("searches vectors through getDataFromQuery", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ result: [{ id: "doc-1", score: 0.9 }] }),
      );
    const qdrant = new Qdrant("https://qdrant.example", undefined, {
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await qdrant.getDataFromQuery({
      client: qdrant.createClient(),
      collectionName: "documents",
      vector: [0.1, 0.2],
      limit: 3,
      filter: { must: [{ key: "source", match: { value: "docs" } }] },
    });

    expect(result).toEqual([{ id: "doc-1", score: 0.9 }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents/points/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          vector: [0.1, 0.2],
          limit: 3,
          filter: { must: [{ key: "source", match: { value: "docs" } }] },
          with_payload: true,
          with_vector: false,
        }),
      }),
    );
  });

  it("deletes points by id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ result: { status: "ok" } }));
    const qdrant = new Qdrant("https://qdrant.example", undefined, {
      fetch: fetchMock as unknown as typeof fetch,
    });

    await qdrant.deleteById({
      client: qdrant.createClient(),
      collectionName: "documents",
      id: 42,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents/points/delete?wait=true",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          points: [42],
        }),
      }),
    );
  });
});

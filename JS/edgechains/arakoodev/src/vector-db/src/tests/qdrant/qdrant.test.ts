import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const okResponse = (body: Record<string, unknown>) =>
  Promise.resolve({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);

describe("Qdrant", () => {
  it("creates a collection using the REST API", async () => {
    const fetchMock = jest.fn(() => okResponse({ status: "ok", result: true }));
    const qdrant = new Qdrant(
      "http://localhost:6333/",
      "api-key",
      fetchMock as typeof fetch,
    );

    await qdrant.createCollection({
      collectionName: "documents",
      size: 1536,
      distance: "Cosine",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections/documents",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "api-key": "api-key",
        },
        body: JSON.stringify({
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        }),
      },
    );
  });

  it("upserts vector data with payload fields", async () => {
    const fetchMock = jest.fn(() =>
      okResponse({ status: "ok", result: { status: "acknowledged" } }),
    );
    const qdrant = new Qdrant(
      "http://localhost:6333",
      undefined,
      fetchMock as typeof fetch,
    );

    await qdrant.insertVectorData({
      collectionName: "documents",
      id: 1,
      embedding: [0.1, 0.2],
      content: "hello",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections/documents/points?wait=true",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          points: [
            {
              id: 1,
              vector: [0.1, 0.2],
              payload: {
                content: "hello",
              },
            },
          ],
        }),
      },
    );
  });

  it("queries points using the universal query endpoint", async () => {
    const fetchMock = jest.fn(() =>
      okResponse({ status: "ok", result: { points: [] } }),
    );
    const qdrant = new Qdrant(
      "http://localhost:6333",
      undefined,
      fetchMock as typeof fetch,
    );

    await qdrant.query({
      collectionName: "documents",
      query: [0.1, 0.2],
      limit: 3,
      withPayload: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections/documents/points/query",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: [0.1, 0.2],
          limit: 3,
          with_payload: true,
          with_vector: false,
        }),
      },
    );
  });
});

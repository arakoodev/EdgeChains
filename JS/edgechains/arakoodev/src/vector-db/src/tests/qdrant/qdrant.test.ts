import { beforeEach, describe, expect, it, vi } from "vitest";

import { Qdrant } from "../../lib/qdrant/qdrant.js";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ result: "ok" }),
  });

  global.fetch = fetchMock;
});

describe("Qdrant", () => {
  it("creates a collection through the REST API", async () => {
    const qdrant = new Qdrant({
      url: "http://localhost:6333",
      apiKey: "test-key",
    });

    await qdrant.createCollection({
      collectionName: "documents",
      vectorSize: 1536,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections/documents",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "api-key": "test-key",
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

  it("upserts vector points without qdrant packages", async () => {
    const qdrant = new Qdrant({ url: "http://localhost:6333" });

    await qdrant.insertVectorData({
      collectionName: "documents",
      points: {
        id: "doc-1",
        vector: [0.1, 0.2],
        payload: { text: "hello" },
      },
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
              id: "doc-1",
              vector: [0.1, 0.2],
              payload: { text: "hello" },
            },
          ],
        }),
      },
    );
  });

  it("searches using the qdrant points search endpoint", async () => {
    const qdrant = new Qdrant({ url: "http://localhost:6333" });

    await qdrant.search({
      collectionName: "documents",
      vector: [0.1, 0.2],
      limit: 3,
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections/documents/points/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vector: [0.1, 0.2],
          limit: 3,
          filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
          with_payload: true,
          with_vector: false,
        }),
      },
    );
  });
});

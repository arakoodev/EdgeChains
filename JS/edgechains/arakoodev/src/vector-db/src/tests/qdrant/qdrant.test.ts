import { describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

function createFetchMock(responseBody: any = { result: { status: "ok" } }) {
  return vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

async function readLastRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const [, init] = fetchMock.mock.calls.at(-1)!;
  return JSON.parse(init.body as string);
}

describe("Qdrant", () => {
  it("creates collections through the REST API without qdrant SDK packages", async () => {
    const fetchMock = createFetchMock();
    const qdrant = new Qdrant("https://qdrant.example", "secret", fetchMock);
    const client = qdrant.createClient();

    await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectorSize: 1536,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents",
      expect.objectContaining({
        method: "PUT",
        headers: expect.any(Headers),
      }),
    );
    expect(await readLastRequestBody(fetchMock as any)).toEqual({
      vectors: { size: 1536, distance: "Cosine" },
    });
  });

  it("upserts vector data with payload content", async () => {
    const fetchMock = createFetchMock();
    const qdrant = new Qdrant("https://qdrant.example", "secret", fetchMock);
    const client = qdrant.createClient({ collectionName: "documents" });

    await qdrant.insertVectorData({
      client,
      id: 42,
      content: "hello",
      embedding: [0.1, 0.2],
      source: "unit-test",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents/points?wait=true",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(await readLastRequestBody(fetchMock as any)).toEqual({
      points: [
        {
          id: 42,
          vector: [0.1, 0.2],
          payload: {
            content: "hello",
            source: "unit-test",
          },
        },
      ],
    });
  });

  it("searches vectors and normalizes scored payloads", async () => {
    const fetchMock = createFetchMock({
      result: [
        {
          id: "a",
          score: 0.91,
          payload: { content: "matched" },
        },
      ],
    });
    const qdrant = new Qdrant("https://qdrant.example", undefined, fetchMock);
    const client = qdrant.createClient({ collectionName: "documents" });

    const result = await qdrant.getDataFromQuery({
      client,
      queryVector: [1, 2, 3],
      limit: 5,
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qdrant.example/collections/documents/points/search",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await readLastRequestBody(fetchMock as any)).toEqual({
      vector: [1, 2, 3],
      limit: 5,
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
      with_payload: true,
      with_vector: false,
    });
    expect(result).toEqual([{ id: "a", score: 0.91, content: "matched" }]);
  });

  it("supports scroll, retrieve, payload update, and delete requests", async () => {
    const fetchMock = createFetchMock();
    const qdrant = new Qdrant("https://qdrant.example", "secret", fetchMock);
    const client = qdrant.createClient({ collectionName: "documents" });

    await qdrant.getData({ client, limit: 2 });
    await qdrant.getDataById({ client, id: "point-1" });
    await qdrant.updateById({
      client,
      id: "point-1",
      updatedContent: { content: "updated" },
    });
    await qdrant.deleteById({ client, id: "point-1" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://qdrant.example/collections/documents/points/scroll",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://qdrant.example/collections/documents/points",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://qdrant.example/collections/documents/points/payload?wait=true",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://qdrant.example/collections/documents/points/delete?wait=true",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("raises useful errors for failed Qdrant responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("bad request", {
        status: 400,
      }),
    ) as unknown as typeof fetch;
    const qdrant = new Qdrant("https://qdrant.example", "secret", fetchMock);
    const client = qdrant.createClient({ collectionName: "documents" });

    await expect(
      qdrant.getDataFromQuery({ client, embedding: [0.1], limit: 1 }),
    ).rejects.toThrow("Qdrant request failed with 400: bad request");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

const put = vi.fn();
const post = vi.fn();
const client = { put, post } as any;

describe("Qdrant", () => {
  beforeEach(() => {
    put.mockReset();
    post.mockReset();
  });

  it("creates a collection with vector configuration", async () => {
    put.mockResolvedValueOnce({
      data: { status: "ok", result: true },
    });

    const qdrant = new Qdrant();
    const result = await qdrant.createCollection({
      client,
      collectionName: "documents",
      vectors: { size: 1536, distance: "Cosine" },
      replicationFactor: 2,
      writeConsistencyFactor: 1,
      shardNumber: 3,
    });

    expect(put).toHaveBeenCalledWith("/collections/documents", {
      vectors: { size: 1536, distance: "Cosine" },
      replication_factor: 2,
      write_consistency_factor: 1,
      shard_number: 3,
    });
    expect(result.result).toBe(true);
  });

  it("upserts vector points through the Qdrant REST API", async () => {
    put.mockResolvedValueOnce({
      data: { status: "ok", result: { status: "acknowledged" } },
    });

    const qdrant = new Qdrant("http://localhost:6333", "test-key");
    const result = await qdrant.insertVectorData({
      client,
      collectionName: "documents",
      id: 1,
      vector: [0.1, 0.2, 0.3],
      payload: { content: "hello" },
    });

    expect(put).toHaveBeenCalledWith(
      "/collections/documents/points",
      {
        points: [
          {
            id: 1,
            vector: [0.1, 0.2, 0.3],
            payload: { content: "hello" },
          },
        ],
      },
      { params: { wait: true } },
    );
    expect(result.result.status).toBe("acknowledged");
  });

  it("updates vector points by reusing the upsert endpoint", async () => {
    put.mockResolvedValueOnce({
      data: { status: "ok", result: { status: "acknowledged" } },
    });

    const qdrant = new Qdrant();
    await qdrant.updateById({
      client,
      collectionName: "documents",
      id: "point-2",
      vector: [0.4, 0.5, 0.6],
      payload: { content: "updated" },
      wait: false,
      ordering: "strong",
    });

    expect(put).toHaveBeenCalledWith(
      "/collections/documents/points",
      {
        points: [
          {
            id: "point-2",
            vector: [0.4, 0.5, 0.6],
            payload: { content: "updated" },
          },
        ],
      },
      { params: { wait: false, ordering: "strong" } },
    );
  });

  it("queries nearest points through /points/query", async () => {
    post.mockResolvedValueOnce({
      data: { status: "ok", result: { points: [{ id: 1, score: 0.99 }] } },
    });

    const qdrant = new Qdrant();
    const result = await qdrant.getDataFromQuery({
      client,
      collectionName: "documents",
      vector: [0.1, 0.2, 0.3],
      limit: 3,
      filter: { must: [{ key: "tenant", match: { value: "demo" } }] },
    });

    expect(post).toHaveBeenCalledWith("/collections/documents/points/query", {
      query: [0.1, 0.2, 0.3],
      filter: { must: [{ key: "tenant", match: { value: "demo" } }] },
      limit: 3,
      with_payload: true,
      with_vector: false,
    });
    expect(result.result.points[0].score).toBe(0.99);
  });

  it("deletes vector points by id", async () => {
    post.mockResolvedValueOnce({
      data: { status: "ok", result: { status: "acknowledged" } },
    });

    const qdrant = new Qdrant();
    await qdrant.deleteById({
      client,
      collectionName: "documents",
      id: "point-1",
    });

    expect(post).toHaveBeenCalledWith(
      "/collections/documents/points/delete",
      { points: ["point-1"] },
      { params: { wait: true } },
    );
  });

  it("scrolls points with payloads enabled by default", async () => {
    post.mockResolvedValueOnce({
      data: {
        status: "ok",
        result: { points: [{ id: 1, payload: { content: "hello" } }] },
      },
    });

    const qdrant = new Qdrant();
    const result = await qdrant.getData({
      client,
      collectionName: "documents",
      limit: 5,
    });

    expect(post).toHaveBeenCalledWith("/collections/documents/points/scroll", {
      limit: 5,
      with_payload: true,
      with_vector: false,
    });
    expect(result.result.points[0].payload.content).toBe("hello");
  });

  it("retrieves points by id list", async () => {
    post.mockResolvedValueOnce({
      data: {
        status: "ok",
        result: [{ id: "point-1", vector: [0.1, 0.2, 0.3] }],
      },
    });

    const qdrant = new Qdrant();
    const result = await qdrant.getDataById({
      client,
      collectionName: "documents",
      ids: ["point-1"],
      withVector: true,
    });

    expect(post).toHaveBeenCalledWith("/collections/documents/points", {
      ids: ["point-1"],
      with_payload: true,
      with_vector: true,
    });
    expect(result.result[0].id).toBe("point-1");
  });

  it("rejects inserts without either points or an id/vector pair", async () => {
    const qdrant = new Qdrant();

    await expect(
      qdrant.insertVectorData({
        client,
        collectionName: "documents",
        id: "point-without-vector",
      }),
    ).rejects.toThrow(
      "Qdrant insertVectorData requires points or id and vector.",
    );
  });

  it("rejects deletes without id, ids, or filter", async () => {
    const qdrant = new Qdrant();

    await expect(
      qdrant.deleteById({
        client,
        collectionName: "documents",
      }),
    ).rejects.toThrow("Qdrant deleteById requires id, ids, or filter.");
  });
});

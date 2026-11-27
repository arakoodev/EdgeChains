import { Qdrant } from "../../lib/qdrant/qdrant";

function mockHttp(
  overrides: Partial<Record<"put" | "post" | "get", any>> = {},
) {
  return {
    put: jest.fn().mockResolvedValue({ status: 200, data: { result: true } }),
    post: jest.fn().mockResolvedValue({ status: 200, data: { result: [] } }),
    get: jest.fn().mockResolvedValue({ status: 200, data: { result: {} } }),
    ...overrides,
  } as any;
}

describe("Qdrant", () => {
  test("createCollection issues PUT with vectors config", async () => {
    const http = mockHttp();
    const qdrant = new Qdrant({ url: "http://localhost:6333", http });
    const ok = await qdrant.createCollection("docs", {
      size: 384,
      distance: "Cosine",
    });
    expect(ok).toBe(true);
    expect(http.put).toHaveBeenCalledWith("/collections/docs", {
      vectors: { size: 384, distance: "Cosine" },
    });
  });

  test("upsertPoints sends points and waits", async () => {
    const http = mockHttp();
    const qdrant = new Qdrant({ url: "http://x", http });
    const points = [
      { id: 1, vector: [0.1, 0.2], payload: { content: "hello" } },
    ];
    await qdrant.upsertPoints("docs", points);
    expect(http.put).toHaveBeenCalledWith(
      "/collections/docs/points",
      { points },
      { params: { wait: true } },
    );
  });

  test("search posts query vector and returns results", async () => {
    const results = [{ id: 1, score: 0.9, payload: { a: 1 } }];
    const http = mockHttp({
      post: jest
        .fn()
        .mockResolvedValue({ status: 200, data: { result: results } }),
    });
    const qdrant = new Qdrant({ url: "http://x", http });
    const res = await qdrant.search("docs", [0.1, 0.2], { limit: 3 });
    expect(res).toEqual(results);
    expect(http.post).toHaveBeenCalledWith("/collections/docs/points/search", {
      vector: [0.1, 0.2],
      limit: 3,
      filter: undefined,
      with_payload: true,
      with_vector: false,
      score_threshold: undefined,
    });
  });

  test("getPoints posts ids", async () => {
    const http = mockHttp();
    const qdrant = new Qdrant({ url: "http://x", http });
    await qdrant.getPoints("docs", [1, 2]);
    expect(http.post).toHaveBeenCalledWith("/collections/docs/points", {
      ids: [1, 2],
      with_payload: true,
      with_vector: false,
    });
  });

  test("deletePoints posts ids", async () => {
    const http = mockHttp();
    const qdrant = new Qdrant({ url: "http://x", http });
    await qdrant.deletePoints("docs", [1]);
    expect(http.post).toHaveBeenCalledWith(
      "/collections/docs/points/delete",
      { points: [1] },
      { params: { wait: true } },
    );
  });

  test("getCollectionInfo returns result payload", async () => {
    const info = { status: "green", points_count: 3 };
    const http = mockHttp({
      get: jest.fn().mockResolvedValue({ status: 200, data: { result: info } }),
    });
    const qdrant = new Qdrant({ url: "http://x", http });
    expect(await qdrant.getCollectionInfo("docs")).toEqual(info);
  });

  test("4xx errors are not retried", async () => {
    const http = mockHttp({
      put: jest.fn().mockRejectedValue({
        response: { status: 400, data: { error: "bad request" } },
      }),
    });
    const qdrant = new Qdrant({ url: "http://x", http });
    await expect(qdrant.createCollection("docs", { size: 4 })).rejects.toThrow(
      "Qdrant request failed with status 400",
    );
    expect(http.put).toHaveBeenCalledTimes(1);
  });
});

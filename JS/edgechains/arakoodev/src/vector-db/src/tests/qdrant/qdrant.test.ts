import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

const operation = { operation_id: 1, status: "completed" };
const fetchMock = vi.fn<typeof fetch>();
const ok = (result: unknown) =>
  new Response(JSON.stringify({ status: "ok", result }), {
    headers: { "Content-Type": "application/json" },
  });

describe("Qdrant REST client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset().mockImplementation(async () => ok(operation));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const client = () =>
    new Qdrant({ url: "https://qdrant.test/proxy/", apiKey: "test-key" });
  const sent = () => {
    const [url, init] = fetchMock.mock.calls[0];
    return {
      url,
      ...init,
      body:
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    };
  };

  it("creates a collection through the REST API and returns the envelope result", async () => {
    fetchMock.mockResolvedValue(ok(true));
    await expect(
      client().createCollection("documents", { size: 3, distance: "Cosine" }),
    ).resolves.toBe(true);
    expect(sent()).toMatchObject({
      url: "https://qdrant.test/proxy/collections/documents",
      method: "PUT",
      body: { vectors: { size: 3, distance: "Cosine" } },
      headers: { "Content-Type": "application/json", "api-key": "test-key" },
      redirect: "error",
    });
  });

  it("passes named vectors to collection creation and point insertion", async () => {
    const q = client();
    await q.createCollection("docs", { title: { size: 2, distance: "Dot" } });
    expect(sent().body).toEqual({
      vectors: { title: { size: 2, distance: "Dot" } },
    });
    fetchMock.mockClear();
    await q.upsert("docs", [{ id: 0, vector: { title: [0, -1] } }]);
    expect(sent().body).toEqual({
      points: [{ id: 0, vector: { title: [0, -1] } }],
    });
  });

  it("upserts numeric and UUID IDs with Unicode payloads; waits for writes", async () => {
    const points = [
      { id: 0, vector: [1, 0], payload: { text: "雪 🦊", nested: { n: 2 } } },
      { id: "550e8400-e29b-41d4-a716-446655440000", vector: [0, 1] },
    ];
    await expect(client().upsert("docs", points)).resolves.toEqual(operation);
    expect(sent()).toMatchObject({
      method: "PUT",
      url: "https://qdrant.test/proxy/collections/docs/points?wait=true",
      body: { points },
    });
  });

  it("uses Query API and preserves filtering, score thresholds, named vectors and explicit false flags", async () => {
    const points = [
      { id: 1, score: 0.9, version: 1, payload: { text: "hello" } },
    ];
    fetchMock.mockResolvedValue(ok({ points }));
    const options = Object.freeze({
      limit: 2,
      offset: 0,
      score_threshold: 0,
      using: "title",
      with_payload: false,
      with_vector: false,
      filter: { must: [{ key: "namespace", match: { value: "public" } }] },
    });
    await expect(client().search("docs", [1, 2], options)).resolves.toEqual(
      points,
    );
    expect(sent()).toMatchObject({
      method: "POST",
      url: "https://qdrant.test/proxy/collections/docs/points/query",
      body: { ...options, query: [1, 2] },
    });
  });

  it("returns an empty search result without treating it as a failure", async () => {
    fetchMock.mockResolvedValue(ok({ points: [] }));
    await expect(client().search("docs", [1])).resolves.toEqual([]);
    expect(sent().body).toEqual({ query: [1], limit: 10, with_payload: true });
  });

  it("retrieves full records without mutating IDs", async () => {
    const ids = [0, 2];
    fetchMock.mockResolvedValue(ok([{ id: 0, payload: {}, vector: [1] }]));
    await expect(client().retrieve("docs", ids)).resolves.toEqual([
      { id: 0, payload: {}, vector: [1] },
    ]);
    expect(sent()).toMatchObject({
      method: "POST",
      body: { ids, with_payload: true, with_vector: true },
    });
    expect(ids).toEqual([0, 2]);
  });

  it("deletes points with an explicit selector and merges payloads using the documented routes", async () => {
    const q = client();
    await q.deletePoints("docs", [1]);
    expect(sent()).toMatchObject({
      url: "https://qdrant.test/proxy/collections/docs/points/delete?wait=true",
      method: "POST",
      body: { points: [1] },
    });
    fetchMock.mockClear();
    await q.setPayload("docs", [1], { text: "updated" });
    expect(sent()).toMatchObject({
      url: "https://qdrant.test/proxy/collections/docs/points/payload?wait=true",
      method: "POST",
      body: { points: [1], payload: { text: "updated" } },
    });
  });

  it("lists and deletes collections without attaching a request body", async () => {
    const q = new Qdrant({ url: "http://localhost:6333" });
    fetchMock
      .mockResolvedValueOnce(ok({ collections: [] }))
      .mockResolvedValueOnce(ok(true));
    await expect(q.listCollections()).resolves.toEqual({ collections: [] });
    expect(sent()).toMatchObject({
      method: "GET",
      body: undefined,
      headers: { "Content-Type": "application/json" },
    });
    expect(sent().headers).not.toHaveProperty("api-key");
    fetchMock.mockClear();
    await expect(q.deleteCollection("docs")).resolves.toBe(true);
    expect(sent()).toMatchObject({ method: "DELETE", body: undefined });
  });

  it("encodes collection names as one path segment", async () => {
    await client().retrieve("a/b ?#雪", []);
    expect(sent().url).toBe(
      "https://qdrant.test/proxy/collections/a%2Fb%20%3F%23%E9%9B%AA/points",
    );
  });

  it.each(["", ".", ".."])(
    "rejects invalid collection name %j before I/O",
    (name) => {
      expect(() => client().retrieve(name, [])).toThrow(TypeError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    "ftp://host",
    "https://user:pass@host",
    "https://host?q=1",
    "https://host/#fragment",
    "relative",
  ])("rejects URL %s", (url) => {
    expect(() => new Qdrant({ url })).toThrow();
  });

  it.each([0, -1, 0.5, NaN, Infinity, 2147483648])(
    "rejects timeout %j",
    (timeoutMs) => {
      expect(() => new Qdrant({ url: "https://host", timeoutMs })).toThrow(
        RangeError,
      );
    },
  );

  it.each([NaN, Infinity, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, ""])(
    "rejects invalid ID %j before I/O",
    (id) => {
      const q = client();
      for (const call of [
        () => q.upsert("x", [{ id, vector: [1] }]),
        () => q.retrieve("x", [id]),
        () => q.deletePoints("x", [id]),
        () => q.setPayload("x", [id], {}),
      ])
        expect(call).toThrow(TypeError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([[], [NaN], [Infinity], [-Infinity], new Array<number>(2)])(
    "rejects invalid vectors %j",
    (vector) => {
      expect(() => client().upsert("x", [{ id: 1, vector }])).toThrow(
        TypeError,
      );
      return expect(client().search("x", vector)).rejects.toThrow(TypeError);
    },
  );

  it("rejects an empty named vector map", () => {
    expect(() => client().upsert("x", [{ id: 1, vector: {} }])).toThrow(
      TypeError,
    );
  });

  it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid limit %j", (limit) =>
    expect(client().search("x", [1], { limit })).rejects.toThrow(RangeError),
  );
  it.each([-1, 1.5, NaN, Infinity])("rejects invalid offset %j", (offset) =>
    expect(client().search("x", [1], { offset })).rejects.toThrow(RangeError),
  );
  it("rejects a nonfinite threshold", () =>
    expect(client().search("x", [1], { score_threshold: NaN })).rejects.toThrow(
      RangeError,
    ));

  it.each([400, 401, 403, 404, 409, 429, 500, 503])(
    "propagates HTTP %i without leaking server text",
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response("secret prompt test-key", { status }),
      );
      await expect(client().listCollections()).rejects.toThrow(
        new Error(`Qdrant GET request failed (HTTP ${status})`),
      );
    },
  );

  it.each([
    null,
    {},
    { result: [] },
    { status: "error", result: [] },
    { status: "ok" },
  ])("rejects a malformed envelope %j", async (envelope) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(envelope)));
    await expect(client().listCollections()).rejects.toThrow(
      "Invalid Qdrant response",
    );
  });

  it("rejects invalid JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>gateway error</html>"));
    await expect(client().listCollections()).rejects.toThrow();
  });

  it("rejects malformed query results", async () => {
    fetchMock.mockResolvedValue(ok({ points: null }));
    await expect(client().search("x", [1])).rejects.toThrow(
      "Invalid Qdrant query result",
    );
  });

  it("does not swallow transport failures", async () => {
    fetchMock.mockRejectedValue(new Error("network unavailable"));
    await expect(client().listCollections()).rejects.toThrow(
      "network unavailable",
    );
  });

  it("aborts a stalled request and clears its timer", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    const promise = expect(
      new Qdrant({ url: "https://host", timeoutMs: 20 }).listCollections(),
    ).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(20);
    await promise;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the timeout active until a streamed body completes", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      async (_url, init) =>
        ({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () =>
                reject(new Error("body aborted")),
              );
            }),
        }) as Response,
    );
    const promise = expect(
      new Qdrant({ url: "https://host", timeoutMs: 20 }).listCollections(),
    ).rejects.toThrow("body aborted");
    await vi.advanceTimersByTimeAsync(20);
    await promise;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears timers after successful calls and failed serialization", async () => {
    vi.useFakeTimers();
    await client().listCollections();
    expect(vi.getTimerCount()).toBe(0);
    const payload: Record<string, unknown> = {};
    payload.self = payload;
    await expect(client().setPayload("x", [1], payload)).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});

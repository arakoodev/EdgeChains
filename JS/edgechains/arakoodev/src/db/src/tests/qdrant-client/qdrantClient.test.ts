import {
  QdrantClient,
  QdrantClientError,
  QdrantDistanceMetric,
  type QdrantPoint,
} from "../../lib/qdrant-client/QdrantClient.js";

describe("QdrantClient", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  const config = {
    url: "http://localhost:6333/",
    collection: "edgechains_docs",
    vectorSize: 4,
    distance: QdrantDistanceMetric.COSINE,
  };

  const okResponse = (body: unknown = null, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === null ? "" : JSON.stringify(body)),
  });

  const point: QdrantPoint = {
    id: "doc-1",
    vector: [0.1, 0.2, 0.3, 0.4],
    payload: { text: "hello world" },
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = originalFetch;
  });

  test("createCollection posts the vectors config and strips trailing slashes", async () => {
    fetchMock.mockResolvedValue(okResponse({ result: true }));
    const client = new QdrantClient(config);

    await client.createCollection();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:6333/collections/edgechains_docs");
    expect(init.method).toBe("PUT");
    expect(init.headers["api-key"]).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({
      vectors: { size: 4, distance: "Cosine" },
    });
  });

  test("sends the api-key header when configured", async () => {
    fetchMock.mockResolvedValue(okResponse());
    const client = new QdrantClient({ ...config, apiKey: "secret-key" });

    await client.createCollection();

    expect(fetchMock.mock.calls[0][1].headers["api-key"]).toBe("secret-key");
  });

  test("collectionExists resolves true on 200 and false on 404", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ result: {} }));
    await expect(new QdrantClient(config).collectionExists()).resolves.toBe(
      true,
    );

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(new QdrantClient(config).collectionExists()).resolves.toBe(
      false,
    );
  });

  test("upsert waits and sends points", async () => {
    fetchMock.mockResolvedValue(
      okResponse({ result: { status: "completed" } }),
    );
    const client = new QdrantClient(config);

    await client.upsert([point, { id: 2, vector: [1, 0, 0, 0] }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:6333/collections/edgechains_docs/points?wait=true",
    );
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      points: [
        {
          id: "doc-1",
          vector: [0.1, 0.2, 0.3, 0.4],
          payload: { text: "hello world" },
        },
        { id: 2, vector: [1, 0, 0, 0], payload: {} },
      ],
    });
  });

  test("search defaults to limit 10 with payload and maps the hits", async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        result: [
          { id: "doc-1", score: 0.98, payload: { text: "hello" } },
          { id: "doc-2", score: 0.81, payload: { text: "world" } },
        ],
      }),
    );
    const client = new QdrantClient(config);

    const hits = await client.search([0.1, 0.2, 0.3, 0.4]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:6333/collections/edgechains_docs/points/search",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      vector: [0.1, 0.2, 0.3, 0.4],
      limit: 10,
      filter: undefined,
      with_payload: true,
      score_threshold: undefined,
      exact: undefined,
    });
    expect(hits).toEqual([
      { id: "doc-1", score: 0.98, payload: { text: "hello" } },
      { id: "doc-2", score: 0.81, payload: { text: "world" } },
    ]);
  });

  test("search honors options", async () => {
    fetchMock.mockResolvedValue(okResponse({ result: [] }));
    const client = new QdrantClient(config);

    await client.search([0, 0, 0, 0], {
      limit: 3,
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
      withPayload: false,
      scoreThreshold: 0.5,
      exact: true,
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      vector: [0, 0, 0, 0],
      limit: 3,
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
      with_payload: false,
      score_threshold: 0.5,
      exact: true,
    });
  });

  test("search returns an empty list when the result is empty", async () => {
    fetchMock.mockResolvedValue(okResponse({ result: [] }));
    const client = new QdrantClient(config);

    await expect(client.search([0, 0, 0, 0])).resolves.toEqual([]);
  });

  test("throws QdrantClientError with status and body on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"status":{"error":"collection not found"}}',
    });
    const client = new QdrantClient(config);

    await expect(client.upsert([point])).rejects.toThrow(QdrantClientError);
    await expect(client.upsert([point])).rejects.toThrow(/status 400/);
  });

  test("deleteCollection sends DELETE", async () => {
    fetchMock.mockResolvedValue(okResponse());
    const client = new QdrantClient(config);

    await client.deleteCollection();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:6333/collections/edgechains_docs");
    expect(init.method).toBe("DELETE");
  });
});

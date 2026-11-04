import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { QdrantClient } from "../../lib/qdrant/QdrantClient.js";

describe("QdrantClient REST transport", () => {
  let endpoint: string;
  let requests: {
    method: string | undefined;
    url: string | undefined;
    headers: IncomingHttpHeaders;
    body: unknown;
  }[] = [];
  let status = 200;
  let response: unknown = { status: "ok", result: true };
  let delay = 0;
  const server = createServer(async (request, res) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    requests.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: raw ? JSON.parse(raw) : undefined,
    });
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    res.writeHead(status, {
      "content-type": "application/json",
      location: "/redirected",
    });
    res.end(JSON.stringify(response));
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/qdrant/`;
  });
  afterEach(() => {
    requests = [];
    status = 200;
    response = { status: "ok", result: true };
    delay = 0;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("creates a collection, preserves the deployment prefix, and sends the API key", async () => {
    const client = new QdrantClient({ url: endpoint, apiKey: "test-key" });
    expect(
      await client.createCollection("notes / team", {
        size: 3,
        distance: "Cosine",
      }),
    ).toBe(true);
    expect(requests[0]).toMatchObject({
      method: "PUT",
      url: "/qdrant/collections/notes%20%2F%20team",
      body: { vectors: { size: 3, distance: "Cosine" } },
    });
    expect(requests[0].headers["api-key"]).toBe("test-key");
  });

  it("upserts vectors and payloads and waits for completion", async () => {
    response = {
      status: "ok",
      result: { operation_id: 1, status: "completed" },
    };
    const points = [
      { id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "example" } },
    ];
    expect(
      await new QdrantClient({ url: endpoint }).upsert("notes", points),
    ).toEqual({ operation_id: 1, status: "completed" });
    expect(requests[0]).toMatchObject({
      method: "PUT",
      url: "/qdrant/collections/notes/points?wait=true",
      body: { points },
    });
    expect(requests[0].headers["api-key"]).toBeUndefined();
  });

  it("queries with a namespace filter and returns scored payloads", async () => {
    const points = [{ id: 1, score: 0.9, payload: { text: "match" } }];
    response = { status: "ok", result: { points } };
    const query = {
      query: [1, 0, 0],
      limit: 2,
      filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
    };
    expect(
      await new QdrantClient({ url: endpoint }).query("notes", query),
    ).toEqual(points);
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/qdrant/collections/notes/points/query",
      body: { ...query, with_payload: true },
    });
    expect(query).not.toHaveProperty("with_payload");
  });

  it("deletes selected points and a collection", async () => {
    const client = new QdrantClient({ url: endpoint });
    response = { status: "ok", result: { status: "completed" } };
    await client.deletePoints("notes", [
      1,
      "00000000-0000-0000-0000-000000000002",
    ]);
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/qdrant/collections/notes/points/delete?wait=true",
      body: { points: [1, "00000000-0000-0000-0000-000000000002"] },
    });
    response = { status: "ok", result: true };
    expect(await client.deleteCollection("notes")).toBe(true);
    expect(requests[1]).toMatchObject({
      method: "DELETE",
      url: "/qdrant/collections/notes",
      body: undefined,
    });
  });

  it("propagates API errors instead of returning an empty successful result", async () => {
    status = 400;
    response = { status: { error: "Wrong vector dimension" } };
    await expect(
      new QdrantClient({ url: endpoint }).query("notes", { query: [1] }),
    ).rejects.toThrow("HTTP 400");
  });

  it("rejects unsuccessful envelopes", async () => {
    response = { status: { error: "failure" }, result: null };
    await expect(
      new QdrantClient({ url: endpoint }).deleteCollection("notes"),
    ).rejects.toThrow("unsuccessful response");
  });

  it("aborts requests at the configured deadline", async () => {
    delay = 100;
    await expect(
      new QdrantClient({ url: endpoint, timeoutMs: 20 }).query("notes", {
        query: [1],
      }),
    ).rejects.toThrow();
  });

  it("does not forward API keys on redirects", async () => {
    status = 307;
    await expect(
      new QdrantClient({ url: endpoint, apiKey: "test-key" }).deleteCollection(
        "notes",
      ),
    ).rejects.toThrow();
    expect(requests).toHaveLength(1);
  });

  it.each(["", ".", ".."])(
    'rejects invalid collection name "%s" before a request',
    (name) => {
      expect(() =>
        new QdrantClient({ url: endpoint }).deleteCollection(name),
      ).toThrow();
      expect(requests).toHaveLength(0);
    },
  );
});

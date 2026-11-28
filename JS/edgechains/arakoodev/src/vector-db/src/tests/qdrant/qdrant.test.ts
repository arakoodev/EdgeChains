import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

// HTTP contract fixture; this does not simulate a Qdrant storage engine.
let server: Server;
let db: Qdrant;
let url: string;
let status: number;
let result: unknown;
let raw: string | undefined;
let holdBody: boolean;
let redirect: string | undefined;
let requests: { method?: string; url?: string; key?: string; body: any }[];

beforeEach(async () => {
  status = 200;
  result = true;
  raw = undefined;
  redirect = undefined;
  holdBody = false;
  requests = [];
  server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({
      method: req.method,
      url: req.url,
      key: req.headers["api-key"] as string,
      body: JSON.parse(body),
    });
    res.writeHead(status, {
      "Content-Type": "application/json",
      ...(redirect ? { Location: redirect } : {}),
    });
    if (holdBody) {
      res.write('{"status":"ok",');
      return;
    }
    res.end(raw ?? JSON.stringify({ status: "ok", result }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected TCP address");
  url = `http://127.0.0.1:${address.port}/proxy/`;
  db = new Qdrant({ url, apiKey: "synthetic-key", timeoutMs: 2000 });
});

afterEach(async () => {
  const closed = once(server, "close");
  server.close();
  server.closeAllConnections();
  await closed;
});

describe("Qdrant REST contract", () => {
  it("creates collections, preserving the proxy prefix and API key", async () => {
    await expect(
      db.createCollection({ collectionName: "my documents", size: 3 }),
    ).resolves.toBe(true);
    expect(requests).toEqual([
      {
        method: "PUT",
        url: "/proxy/collections/my%20documents",
        key: "synthetic-key",
        body: { vectors: { size: 3, distance: "Cosine" } },
      },
    ]);
  });
  it("upserts numeric and UUID points and waits for the write", async () => {
    const points = [
      { id: 0, vector: [1, 0], payload: { content: "one" } },
      { id: "c268782a-8f31-4ec0-a9c7-bcabc0dba4ec", vector: [0, 1] },
    ];
    result = { operation_id: 1, status: "completed" };
    await expect(
      db.insertVectorData({ collectionName: "docs", points }),
    ).resolves.toEqual(result);
    expect(requests[0]).toMatchObject({
      method: "PUT",
      url: "/proxy/collections/docs/points?wait=true",
      body: { points },
    });
  });
  it("queries points with a filter, payload and zero threshold", async () => {
    const points = [{ id: 1, score: 0.95, payload: { content: "one" } }];
    const filter = { must: [{ key: "kind", match: { value: "note" } }] };
    result = { points };
    await expect(
      db.getDataFromQuery({
        collectionName: "docs",
        vector: [1, 0],
        limit: 3,
        filter,
        scoreThreshold: 0,
      }),
    ).resolves.toEqual(points);
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/proxy/collections/docs/points/query",
      body: {
        query: [1, 0],
        limit: 3,
        filter,
        score_threshold: 0,
        with_payload: true,
      },
    });
  });
  it("keeps scroll cursors, including zero, instead of silently dropping pages", async () => {
    result = { points: [{ id: 0 }], next_page_offset: 5 };
    expect(
      await db.getData({ collectionName: "docs", limit: 1, offset: 0 }),
    ).toEqual(result);
    expect(requests[0].body).toEqual({
      limit: 1,
      offset: 0,
      with_payload: true,
    });
    result = { points: [], next_page_offset: null };
    expect(await db.getData({ collectionName: "docs", offset: 5 })).toEqual(
      result,
    );
    expect(requests[1].body.offset).toBe(5);
  });
  it("retrieves stored vectors and returns null for an absent ID", async () => {
    result = [{ id: 42, vector: [1, 0], payload: { content: "one" } }];
    expect(await db.getDataById({ collectionName: "docs", id: 42 })).toEqual(
      (result as any[])[0],
    );
    expect(requests[0].body).toEqual({
      ids: [42],
      with_payload: true,
      with_vector: true,
    });
    result = [];
    await expect(
      db.getDataById({ collectionName: "docs", id: 43 }),
    ).resolves.toBeNull();
  });
  it("updates payload without replacing stored vectors or other fields", async () => {
    result = { operation_id: 2, status: "completed" };
    await db.updateById({
      collectionName: "docs",
      id: 42,
      updatedContent: { title: "corrected" },
    });
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/proxy/collections/docs/points/payload?wait=true",
      body: { points: [42], payload: { title: "corrected" } },
    });
    expect(requests[0].body).not.toHaveProperty("vector");
  });
  it("deletes the selected ID with wait=true", async () => {
    result = { operation_id: 3, status: "completed" };
    expect(await db.deleteById({ collectionName: "docs", id: 0 })).toEqual(
      result,
    );
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/proxy/collections/docs/points/delete?wait=true",
      body: { points: [0] },
    });
  });
  it("supports a local server without an API key", async () => {
    await new Qdrant({ url }).createCollection({
      collectionName: "docs",
      size: 3,
    });
    expect(requests[0].key).toBeUndefined();
  });
  it("does not echo response secrets or retry failed writes", async () => {
    status = 401;
    raw = "synthetic-key";
    await expect(
      db.deleteById({ collectionName: "docs", id: 0 }),
    ).rejects.toThrow("Qdrant request failed (HTTP 401)");
    expect(requests).toHaveLength(1);
  });
  it("rejects malformed JSON and unsuccessful response envelopes", async () => {
    raw = "not json";
    await expect(db.getData({ collectionName: "docs" })).rejects.toThrow();
    raw = JSON.stringify({ status: { error: "bad query" }, result: null });
    await expect(db.getData({ collectionName: "docs" })).rejects.toThrow(
      "Invalid Qdrant response",
    );
  });
  it("times out even after response headers have arrived", async () => {
    holdBody = true;
    await expect(
      new Qdrant({ url, timeoutMs: 100 }).getData({ collectionName: "docs" }),
    ).rejects.toThrow();
    expect(requests).toHaveLength(1);
  });
  it("refuses redirects instead of forwarding the API key", async () => {
    status = 307;
    redirect = `${url}unexpected`;
    await expect(db.getData({ collectionName: "docs" })).rejects.toThrow();
    expect(requests).toHaveLength(1);
  });
  it("rejects invalid input before any network call", () => {
    expect(() =>
      db.createCollection({ collectionName: "docs", size: 0 }),
    ).toThrow();
    expect(() => db.getData({ collectionName: "docs", limit: -1 })).toThrow();
    expect(() =>
      db.insertVectorData({
        collectionName: "docs",
        points: [{ id: Number.MAX_SAFE_INTEGER + 1, vector: [1] }],
      }),
    ).toThrow();
    expect(() =>
      db.insertVectorData({
        collectionName: "docs",
        points: [{ id: 1, vector: [NaN] }],
      }),
    ).toThrow();
    expect(() =>
      db.insertVectorData({ collectionName: "docs", points: [] }),
    ).toThrow();
    expect(
      () => new Qdrant({ url: "https://user:secret@example.com" }),
    ).toThrow();
    expect(() => new Qdrant({ url, timeoutMs: 0 })).toThrow();
    expect(requests).toEqual([]);
  });
});

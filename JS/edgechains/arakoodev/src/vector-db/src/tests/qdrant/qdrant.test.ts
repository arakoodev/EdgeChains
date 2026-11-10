import { afterEach, describe, expect, it, vi } from "vitest";
import { Qdrant, QdrantError } from "../../index.js";

const response = (result: unknown) => new Response(JSON.stringify({ status: "ok", result }));
const fake = (result: unknown = true) =>
    vi.fn<typeof fetch>().mockImplementation(async () => response(result));
const client = (fetcher: typeof fetch, options = {}) =>
    new Qdrant({
        url: "https://qdrant.invalid/proxy/",
        apiKey: "unit-test-secret",
        fetch: fetcher,
        ...options,
    });
afterEach(() => vi.useRealTimers());

describe("Qdrant REST client", () => {
    it("exports the class without a Qdrant SDK dependency", () =>
        expect(Qdrant).toBeTypeOf("function"));
    it("creates a collection using PUT, a prefix-preserving encoded path and api-key", async () => {
        const request = fake();
        expect(
            await client(request).createCollection("my collection", { size: 3, distance: "Cosine" })
        ).toBe(true);
        const [url, options] = request.mock.calls[0];
        expect(url).toBe("https://qdrant.invalid/proxy/collections/my%20collection");
        expect(options).toMatchObject({
            method: "PUT",
            redirect: "error",
            headers: { "api-key": "unit-test-secret", "Content-Type": "application/json" },
        });
        expect(JSON.parse(options!.body as string)).toEqual({
            vectors: { size: 3, distance: "Cosine" },
        });
    });
    it("supports named vectors", async () => {
        const request = fake();
        const vectors = { text: { size: 3, distance: "Dot" as const } };
        await client(request).createCollection("named", vectors);
        expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({ vectors });
    });
    it("does not expose the private key when serializing the client", () => {
        expect(JSON.stringify(client(fake()))).not.toContain("unit-test-secret");
    });
    it("gets collection info without a request body", async () => {
        const request = fake({ status: "green" });
        expect(await client(request).getCollection("docs")).toEqual({ status: "green" });
        expect(request.mock.calls[0][1]).toMatchObject({ method: "GET", body: undefined });
    });
    it("deletes a collection using DELETE", async () => {
        const request = fake();
        await client(request).deleteCollection("docs");
        expect(request.mock.calls[0][1]?.method).toBe("DELETE");
    });
    it("upserts vectors and metadata with wait=true", async () => {
        const request = fake({ status: "completed", operation_id: 0 });
        const values = [{ id: 0, vector: [0, 1, -1], payload: { text: "O'Brien β", tag: null } }];
        await client(request).upsertPoints("docs", values);
        expect(request.mock.calls[0][0]).toContain("/points?wait=true");
        expect(request.mock.calls[0][1]?.method).toBe("PUT");
        expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({ points: values });
    });
    it("queries with filters, named vectors and explicit false flags", async () => {
        const request = fake({ points: [{ id: 1, score: 0.75 }] });
        const filter = { must: [{ key: "kind", match: { value: "guide" } }] };
        expect(
            await client(request).query("docs", {
                vector: [0, 1],
                limit: 2,
                using: "text",
                filter,
                scoreThreshold: 0,
                withPayload: false,
                withVector: true,
            })
        ).toEqual([{ id: 1, score: 0.75 }]);
        expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({
            query: [0, 1],
            limit: 2,
            using: "text",
            filter,
            score_threshold: 0,
            with_payload: false,
            with_vector: true,
        });
    });
    it("retrieves numeric zero and UUID identifiers without changing them", async () => {
        const uuid = "550e8400-e29b-41d4-a716-446655440000";
        const request = fake([{ id: uuid }]);
        await client(request).retrievePoints("docs", [0, uuid], true);
        expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({
            ids: [0, uuid],
            with_payload: true,
            with_vector: true,
        });
    });
    it("returns an explicit next-page offset rather than claiming all records", async () => {
        const request = fake({ points: [{ id: 1 }], next_page_offset: 2 });
        expect(await client(request).scroll("docs", { limit: 1, offset: 0 })).toEqual({
            points: [{ id: 1 }],
            nextPageOffset: 2,
        });
        expect(JSON.parse(request.mock.calls[0][1]!.body as string).offset).toBe(0);
    });
    it("returns null when scrolling reaches the end", async () => {
        expect(await client(fake({ points: [], next_page_offset: null })).scroll("docs")).toEqual({
            points: [],
            nextPageOffset: null,
        });
    });
    for (const method of ["setPayload", "deletePoints"] as const) {
        it(`${method} uses explicit point IDs and waits for the update`, async () => {
            const request = fake({ status: "completed" });
            const q = client(request);
            if (method === "setPayload") await q.setPayload("docs", [2], { valid: true });
            else await q.deletePoints("docs", [2]);
            expect(request.mock.calls[0][0]).toContain("?wait=true");
            expect(JSON.parse(request.mock.calls[0][1]!.body as string).points).toEqual([2]);
        });
    }
    for (const bad of ["", ".", ".."])
        it(`rejects invalid collection ${JSON.stringify(bad)}`, async () => {
            const request = fake();
            await expect(client(request).getCollection(bad)).rejects.toThrow(TypeError);
            expect(request).not.toHaveBeenCalled();
        });
    for (const url of [
        "ftp://x/",
        "https://user:secret@x/",
        "https://x/?key=secret",
        "https://x/#fragment",
    ]) {
        it(`rejects unsuitable endpoint ${url}`, () =>
            expect(() => new Qdrant({ url })).toThrow(TypeError));
    }
    for (const timeoutMs of [0, -1, NaN, Infinity, 1.5, 2147483648])
        it(`rejects timeout ${timeoutMs}`, () => {
            expect(() => client(fake(), { timeoutMs })).toThrow(TypeError);
        });
    for (const id of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "not-a-uuid"])
        it(`rejects unsafe point ID ${id}`, async () => {
            const request = fake();
            await expect(client(request).deletePoints("docs", [id])).rejects.toThrow(TypeError);
            expect(request).not.toHaveBeenCalled();
        });
    for (const vector of [[], [NaN], [Infinity], [undefined], new Array(2)])
        it(`rejects invalid vector ${JSON.stringify(vector)}`, async () => {
            const request = fake();
            await expect(
                client(request).query("docs", { vector: vector as number[] })
            ).rejects.toThrow(TypeError);
            expect(request).not.toHaveBeenCalled();
        });
    for (const status of [400, 401, 404, 429, 500])
        it(`preserves HTTP ${status} without replay or remote-body leakage`, async () => {
            const request = vi
                .fn<typeof fetch>()
                .mockResolvedValue(
                    new Response("private remote detail unit-test-secret", { status })
                );
            await expect(client(request).deletePoints("docs", [1])).rejects.toMatchObject({
                name: "QdrantError",
                status,
                message: `Qdrant request failed (HTTP ${status})`,
            });
            expect(request).toHaveBeenCalledTimes(1);
        });
    for (const body of ["not json", "null", '{"status":"error","result":true}', '{"status":"ok"}'])
        it(`rejects malformed envelope ${body}`, async () => {
            const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
            await expect(client(request).getCollection("docs")).rejects.toBeInstanceOf(QdrantError);
        });
    it("rejects unsafe point identifiers in server responses", async () => {
        await expect(
            client(fake([{ id: Number.MAX_SAFE_INTEGER + 1 }])).retrievePoints("docs", [1])
        ).rejects.toThrow("Invalid Qdrant point");
    });
    it("rejects an invalid scored result", async () => {
        await expect(
            client(fake({ points: [{ id: 1, score: "high" }] })).query("docs", { vector: [1] })
        ).rejects.toThrow("Invalid Qdrant point");
    });
    it("does not leak transport errors or retry failed writes", async () => {
        const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("unit-test-secret"));
        await expect(client(request).deletePoints("docs", [1])).rejects.toThrow(
            "Qdrant transport failed"
        );
        expect(request).toHaveBeenCalledTimes(1);
    });
    it("aborts slow requests and reports the uncertain outcome of a write", async () => {
        vi.useFakeTimers();
        const request = vi.fn<typeof fetch>().mockImplementation(
            (_url, options) =>
                new Promise((_resolve, reject) => {
                    options!.signal!.addEventListener("abort", () => reject(new Error("aborted")), {
                        once: true,
                    });
                })
        );
        const checked = expect(
            client(request, { timeoutMs: 10 }).deletePoints("docs", [1])
        ).rejects.toThrow("may already have been applied");
        await vi.advanceTimersByTimeAsync(11);
        await checked;
        expect(request).toHaveBeenCalledTimes(1);
    });
    it("rejects a sparse ID list rather than serializing a null selector", async () => {
        const request = fake();
        await expect(client(request).deletePoints("docs", new Array(2))).rejects.toThrow(TypeError);
        expect(request).not.toHaveBeenCalled();
    });
    it("does not treat a rejected update status as success", async () => {
        await expect(
            client(fake({ status: "clock_rejected" })).deletePoints("docs", [1])
        ).rejects.toThrow("rejected Qdrant update");
    });
});

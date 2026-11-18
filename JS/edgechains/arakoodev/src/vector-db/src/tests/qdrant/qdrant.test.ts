import { describe, it, expect, beforeEach, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

describe("Qdrant", () => {
    let qdrant: Qdrant;

    beforeEach(() => {
        qdrant = new Qdrant("http://localhost:6333", "test-api-key");
    });

    describe("constructor", () => {
        it("should create instance with provided URL and API key", () => {
            expect(qdrant.QDRANT_URL).toBe("http://localhost:6333");
            expect(qdrant.QDRANT_API_KEY).toBe("test-api-key");
        });

        it("should fall back to env vars when args not provided", () => {
            process.env.QDRANT_URL = "http://env-url:6333";
            process.env.QDRANT_API_KEY = "env-key";
            const q = new Qdrant();
            expect(q.QDRANT_URL).toBe("http://env-url:6333");
            expect(q.QDRANT_API_KEY).toBe("env-key");
            delete process.env.QDRANT_URL;
            delete process.env.QDRANT_API_KEY;
        });
    });

    describe("createClient", () => {
        it("should create an axios instance with correct baseURL and headers", () => {
            const client = qdrant.createClient();
            expect(client.defaults.baseURL).toBe("http://localhost:6333");
            expect(client.defaults.headers["api-key"]).toBe("test-api-key");
            expect(client.defaults.headers["Content-Type"]).toBe("application/json");
        });
    });

    describe("insertVectorData", () => {
        it("should upsert points to the correct endpoint", async () => {
            const client = qdrant.createClient();
            const putSpy = vi.spyOn(client, "put").mockResolvedValue({
                status: 200,
                data: { result: { status: "completed" } },
            });

            const result = await qdrant.insertVectorData({
                client,
                tableName: "test-collection",
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: { text: "hello" },
            });

            expect(putSpy).toHaveBeenCalledWith(
                "/collections/test-collection/points?wait=true",
                {
                    points: [
                        { id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "hello" } },
                    ],
                }
            );
            expect(result.result.status).toBe("completed");
        });

        it("should support batch insert via points array", async () => {
            const client = qdrant.createClient();
            const putSpy = vi.spyOn(client, "put").mockResolvedValue({
                status: 200,
                data: { result: { status: "completed" } },
            });

            await qdrant.insertVectorData({
                client,
                tableName: "test-collection",
                points: [
                    { id: 1, vector: [0.1], payload: {} },
                    { id: 2, vector: [0.2], payload: {} },
                ],
            });

            expect(putSpy).toHaveBeenCalledWith(
                "/collections/test-collection/points?wait=true",
                {
                    points: [
                        { id: 1, vector: [0.1], payload: {} },
                        { id: 2, vector: [0.2], payload: {} },
                    ],
                }
            );
        });
    });

    describe("getDataFromQuery", () => {
        it("should search with vector and return results", async () => {
            const client = qdrant.createClient();
            const mockResults = [{ id: 1, score: 0.95, payload: { text: "match" } }];
            vi.spyOn(client, "post").mockResolvedValue({
                status: 200,
                data: { result: mockResults },
            });

            const result = await qdrant.getDataFromQuery({
                client,
                tableName: "test-collection",
                vector: [0.1, 0.2],
                limit: 5,
            });

            expect(result).toEqual(mockResults);
        });
    });

    describe("getData", () => {
        it("should scroll points and return result", async () => {
            const client = qdrant.createClient();
            const mockPoints = { points: [{ id: 1, payload: {} }] };
            vi.spyOn(client, "post").mockResolvedValue({
                status: 200,
                data: { result: mockPoints },
            });

            const result = await qdrant.getData(client, "test-collection", { limit: 10 });
            expect(result).toEqual(mockPoints);
        });
    });

    describe("getDataById", () => {
        it("should fetch a point by ID", async () => {
            const client = qdrant.createClient();
            const mockPoint = { id: 42, vector: [0.1], payload: { text: "found" } };
            vi.spyOn(client, "get").mockResolvedValue({
                data: { result: mockPoint },
            });

            const result = await qdrant.getDataById(client, "test-collection", 42);
            expect(result).toEqual(mockPoint);
        });
    });

    describe("updateById", () => {
        it("should update payload for a point", async () => {
            const client = qdrant.createClient();
            const postSpy = vi.spyOn(client, "post").mockResolvedValue({
                data: { result: { status: "completed" } },
            });

            await qdrant.updateById(client, "test-collection", 42, { text: "updated" });

            expect(postSpy).toHaveBeenCalledWith(
                "/collections/test-collection/points/payload?wait=true",
                { payload: { text: "updated" }, points: [42] }
            );
        });
    });

    describe("deleteById", () => {
        it("should delete a point by ID", async () => {
            const client = qdrant.createClient();
            const postSpy = vi.spyOn(client, "post").mockResolvedValue({
                status: 200,
                data: { result: { status: "completed" } },
            });

            const result = await qdrant.deleteById(client, "test-collection", 42);

            expect(postSpy).toHaveBeenCalledWith(
                "/collections/test-collection/points/delete?wait=true",
                { points: [42] }
            );
            expect(result.status).toBe(200);
        });
    });
});

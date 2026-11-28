import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

const createFetchResponse = (body: any, ok = true) =>
      ({
                ok,
                statusText: ok ? "OK" : "Bad Request",
                text: vi.fn(async () => JSON.stringify(body)),
      }) as any;

describe("Qdrant", () => {
      beforeEach(() => {
                vi.stubGlobal("fetch", vi.fn(async () => createFetchResponse({ result: { status: "ok" } })));
      });

             afterEach(() => {
                       vi.unstubAllGlobals();
                       vi.clearAllMocks();
             });

             it("creates a collection through the Qdrant REST API", async () => {
                       const qdrant = new Qdrant("https://qdrant.example.com", "api-key");

                        await qdrant.createCollection({
                                      collectionName: "documents",
                                      distance: "Cosine",
                                      vectorSize: 1536,
                        });

                        expect(fetch).toHaveBeenCalledWith("https://qdrant.example.com/collections/documents", {
                                      body: JSON.stringify({
                                                        vectors: {
                                                                              distance: "Cosine",
                                                                              size: 1536,
                                                        },
                                      }),
                                      headers: {
                                                        "api-key": "api-key",
                                                        "content-type": "application/json",
                                      },
                                      method: "PUT",
                        });
             });

             it("inserts vector points without using a qdrant package", async () => {
                       const qdrant = new Qdrant("https://qdrant.example.com");

                        await qdrant.insertVectorData({
                                      collectionName: "documents",
                                      points: [
                                        {
                                                              id: 1,
                                                              payload: { content: "hello" },
                                                              vector: [0.1, 0.2, 0.3],
                                        },
                                                    ],
                        });

                        expect(fetch).toHaveBeenCalledWith("https://qdrant.example.com/collections/documents/points?wait=true", {
                                      body: JSON.stringify({
                                                        points: [
                                                          {
                                                                                    id: 1,
                                                                                    payload: { content: "hello" },
                                                                                    vector: [0.1, 0.2, 0.3],
                                                          },
                                                                          ],
                                      }),
                                      headers: {
                                                        "content-type": "application/json",
                                      },
                                      method: "PUT",
                        });
             });

             it("searches points with a vector query", async () => {
                       const qdrant = new Qdrant("https://qdrant.example.com");

                        await qdrant.getDataFromQuery({
                                      collectionName: "documents",
                                      limit: 3,
                                      vector: [0.1, 0.2, 0.3],
                        });

                        expect(fetch).toHaveBeenCalledWith("https://qdrant.example.com/collections/documents/points/search", {
                                      body: JSON.stringify({
                                                        limit: 3,
                                                        vector: [0.1, 0.2, 0.3],
                                                        with_payload: true,
                                                        with_vector: false,
                                      }),
                                      headers: {
                                                        "content-type": "application/json",
                                      },
                                      method: "POST",
                        });
             });
});

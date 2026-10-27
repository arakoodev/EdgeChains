import { Qdrant } from "../../lib/qdrant/qdrant.js";

const jsonResponse = (body: unknown, ok = true, status = 200) =>
    ({
        ok,
        status,
        text: async () => JSON.stringify(body),
    }) as Response;

describe("Qdrant", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("creates a collection using the Qdrant REST API", async () => {
        const fetchMock = jest
            .spyOn(global, "fetch")
            .mockResolvedValue(jsonResponse({ result: true }));

        const qdrant = new Qdrant("http://localhost:6333", "test-key");
        await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 1536,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": "test-key",
                }),
                body: JSON.stringify({
                    vectors: {
                        size: 1536,
                        distance: "Cosine",
                    },
                }),
            })
        );
    });

    it("upserts vector points", async () => {
        const fetchMock = jest
            .spyOn(global, "fetch")
            .mockResolvedValue(jsonResponse({ result: { operation_id: 1 } }));

        const qdrant = new Qdrant("http://localhost:6333");
        await qdrant.insertVectorData({
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { content: "hello" },
                },
            ],
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [
                        {
                            id: 1,
                            vector: [0.1, 0.2, 0.3],
                            payload: { content: "hello" },
                        },
                    ],
                }),
            })
        );
    });

    it("searches vectors with filters", async () => {
        const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
            jsonResponse({
                result: [{ id: 1, score: 0.9, payload: { content: "hello" } }],
            })
        );

        const qdrant = new Qdrant("http://localhost:6333");
        await qdrant.getDataFromQuery({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: { must: [{ key: "source", match: { value: "docs" } }] },
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 3,
                    filter: { must: [{ key: "source", match: { value: "docs" } }] },
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("throws readable errors from Qdrant", async () => {
        jest.spyOn(global, "fetch").mockResolvedValue(
            jsonResponse({ status: { error: "missing collection" } }, false, 404)
        );

        const qdrant = new Qdrant("http://localhost:6333");

        await expect(
            qdrant.getDataById({
                collectionName: "missing",
                ids: [1],
            })
        ).rejects.toThrow("Qdrant request failed with 404");
    });
});

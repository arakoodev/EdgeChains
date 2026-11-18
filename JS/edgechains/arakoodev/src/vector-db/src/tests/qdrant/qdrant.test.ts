import { Qdrant } from "../../lib/qdrant/qdrant";

const mockFetch = jest.fn();

beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as any;
});

describe("Qdrant", () => {
    it("should insert vector data through the Qdrant HTTP API", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ result: { operation_id: 1, status: "completed" } }),
        });

        const qdrant = new Qdrant("https://qdrant.example", "test-api-key", "documents");
        const result = await qdrant.insertVectorData({
            id: "doc-1",
            vector: [0.1, 0.2, 0.3],
            payload: { content: "hello" },
        });

        expect(result).toEqual({ result: { operation_id: 1, status: "completed" } });
        expect(mockFetch).toHaveBeenCalledWith(
            "https://qdrant.example/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "test-api-key",
                },
                body: JSON.stringify({
                    points: [
                        {
                            id: "doc-1",
                            vector: [0.1, 0.2, 0.3],
                            payload: { content: "hello" },
                        },
                    ],
                }),
            })
        );
    });

    it("should search vector data through the Qdrant HTTP API", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ result: [{ id: "doc-1", score: 0.98 }] }),
        });

        const qdrant = new Qdrant("https://qdrant.example", "", "documents");
        const result = await qdrant.getDataFromQuery({
            vector: [0.1, 0.2, 0.3],
            limit: 2,
            filter: { must: [{ key: "source", match: { value: "faq" } }] },
            withPayload: true,
            withVector: false,
        });

        expect(result).toEqual({ result: [{ id: "doc-1", score: 0.98 }] });
        expect(mockFetch).toHaveBeenCalledWith(
            "https://qdrant.example/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 2,
                    filter: { must: [{ key: "source", match: { value: "faq" } }] },
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("should surface Qdrant API errors", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: async () => "bad vector size",
        });

        const qdrant = new Qdrant("https://qdrant.example", "", "documents");

        await expect(
            qdrant.insertVectorData({
                id: 1,
                vector: [1],
            })
        ).rejects.toThrow("Qdrant request failed with 400: bad vector size");
    });
});

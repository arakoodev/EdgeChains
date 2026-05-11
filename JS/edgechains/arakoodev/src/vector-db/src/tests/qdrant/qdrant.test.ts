import { Qdrant } from "../../lib/qdrant/qdrant";

const MOCK_QDRANT_URL = "https://mock-qdrant.test";
const MOCK_QDRANT_API_KEY = "mock-api-key";

const mockFetch = jest.fn();

global.fetch = mockFetch;

beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: { status: "ok" } }),
    });
});

describe("Qdrant", () => {
    it("should upsert vector points using the Qdrant API directly", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        const result = await qdrant.insertVectorData({
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { content: "hello" },
                },
            ],
        });

        expect(result).toEqual({ status: "ok" });
        expect(mockFetch).toHaveBeenCalledWith(
            `${MOCK_QDRANT_URL}/collections/documents/points?wait=true`,
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": MOCK_QDRANT_API_KEY,
                }),
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

    it("should search vector points with payload and vector options", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        await qdrant.getDataFromQuery({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: { must: [{ key: "source", match: { value: "docs" } }] },
            withPayload: true,
            withVector: false,
        });

        expect(mockFetch).toHaveBeenCalledWith(
            `${MOCK_QDRANT_URL}/collections/documents/points/search`,
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 3,
                    filter: { must: [{ key: "source", match: { value: "docs" } }] },
                    with_payload: true,
                    with_vector: false,
                    score_threshold: undefined,
                }),
            })
        );
    });

    it("should throw a helpful error when Qdrant returns an error response", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ status: { error: "Not found" } }),
        });

        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        await expect(
            qdrant.getDataById({ collectionName: "documents", id: 404 })
        ).rejects.toThrow("Qdrant request failed with status 404");
    });
});

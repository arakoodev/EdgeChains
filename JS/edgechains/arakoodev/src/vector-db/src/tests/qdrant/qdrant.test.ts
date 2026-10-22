import { Qdrant } from "../../lib/qdrant/qdrant";

const mockFetch = jest.fn();

beforeEach(() => {
    mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: "ok" }),
    });
    global.fetch = mockFetch as any;
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("Qdrant", () => {
    test("creates a collection through the REST API", async () => {
        const qdrant = new Qdrant("https://qdrant.example.com", "test-key");

        await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 1536,
            distance: "Cosine",
        });

        expect(mockFetch).toHaveBeenCalledWith(
            new URL("https://qdrant.example.com/collections/documents"),
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    "content-type": "application/json",
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

    test("upserts points through the REST API", async () => {
        const qdrant = new Qdrant("https://qdrant.example.com", "test-key");

        await qdrant.insertVectorData({
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { raw_text: "hello" },
                },
            ],
        });

        const [url, options] = mockFetch.mock.calls[0];
        expect(url.toString()).toBe("https://qdrant.example.com/collections/documents/points?wait=true");
        expect(options).toEqual(
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [
                        {
                            id: 1,
                            vector: [0.1, 0.2, 0.3],
                            payload: { raw_text: "hello" },
                        },
                    ],
                }),
            })
        );
    });

    test("searches a collection with vector and payload options", async () => {
        const qdrant = new Qdrant("https://qdrant.example.com", "test-key");

        await qdrant.searchVectorData({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 5,
            filter: {
                must: [{ key: "namespace", match: { value: "docs" } }],
            },
            withPayload: true,
            withVector: false,
            scoreThreshold: 0.8,
        });

        expect(mockFetch).toHaveBeenCalledWith(
            new URL("https://qdrant.example.com/collections/documents/points/search"),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 5,
                    filter: {
                        must: [{ key: "namespace", match: { value: "docs" } }],
                    },
                    with_payload: true,
                    with_vector: false,
                    score_threshold: 0.8,
                }),
            })
        );
    });
});

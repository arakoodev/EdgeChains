import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "https://mock-qdrant.local";
const MOCK_QDRANT_API_KEY = "mock-api-key";

const createJsonResponse = (body: unknown, init: { status?: number } = {}) => {
    const status = init.status ?? 200;
    return {
        ok: status >= 200 && status < 300,
        status,
        text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    } as any;
};

it("should upsert points using the Qdrant REST API", async () => {
    const fetchMock = jest.fn().mockResolvedValue(createJsonResponse({ result: { status: "ok" } }));
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY, { fetch: fetchMock });

    await qdrant.upsertPoints({
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
        `${MOCK_QDRANT_URL}/collections/documents/points?wait=true`,
        expect.objectContaining({
            method: "PUT",
            headers: expect.objectContaining({
                "api-key": MOCK_QDRANT_API_KEY,
                "content-type": "application/json",
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

it("should search points using the Qdrant REST API", async () => {
    const searchResult = [{ id: 1, score: 0.9, payload: { content: "hello" } }];
    const fetchMock = jest.fn().mockResolvedValue(createJsonResponse({ result: searchResult }));
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY, { fetch: fetchMock });

    const result = await qdrant.search({
        collectionName: "documents",
        vector: [0.1, 0.2, 0.3],
        limit: 3,
        filter: { must: [{ key: "source", match: { value: "docs" } }] },
    });

    expect(result).toEqual({ result: searchResult });
    expect(fetchMock).toHaveBeenCalledWith(
        `${MOCK_QDRANT_URL}/collections/documents/points/search`,
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

it("should throw when Qdrant returns an error", async () => {
    const fetchMock = jest
        .fn()
        .mockResolvedValue(createJsonResponse({ status: { error: "missing collection" } }, { status: 404 }));
    const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY, { fetch: fetchMock });

    await expect(
        qdrant.getPointById({
            collectionName: "missing",
            id: "abc",
        })
    ).rejects.toThrow("Qdrant request failed with status 404");
});

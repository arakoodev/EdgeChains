import { Qdrant } from "../../lib/qdrant/qdrant";

const mockFetch = jest.fn();

global.fetch = mockFetch as jest.Mock;

beforeEach(() => {
    mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: { status: "ok" } }),
    });
});

afterEach(() => {
    mockFetch.mockReset();
});

it("should insert points into a qdrant collection", async () => {
    const qdrant = new Qdrant("http://localhost:6333", "test-key");

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
    const [url, options] = mockFetch.mock.calls[0];
    expect(url.toString()).toBe("http://localhost:6333/collections/documents/points?wait=true");
    expect(options).toEqual(
        expect.objectContaining({
            method: "PUT",
            headers: expect.objectContaining({
                "Content-Type": "application/json",
                "api-key": "test-key",
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

it("should search by vector through the qdrant rest api", async () => {
    const qdrant = new Qdrant("http://localhost:6333");

    await qdrant.getDataFromQuery({
        collectionName: "documents",
        vector: [0.1, 0.2, 0.3],
        limit: 3,
        filter: { must: [{ key: "source", match: { value: "docs" } }] },
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url.toString()).toBe("http://localhost:6333/collections/documents/points/search");
    expect(options).toEqual(
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

it("should surface qdrant errors", async () => {
    mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ status: { error: "bad vector size" } }),
    });

    const qdrant = new Qdrant("http://localhost:6333");

    await expect(
        qdrant.getDataById({
            collectionName: "documents",
            id: 1,
        })
    ).rejects.toThrow("Qdrant request failed with status 400: bad vector size");
});

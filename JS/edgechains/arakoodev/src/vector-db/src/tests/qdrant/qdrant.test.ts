import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

function mockResponse(result: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: async () => result,
    } as Response;
}

describe("Qdrant", () => {
    it("creates a collection with an API key", async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockResponse({ result: true }));
        const qdrant = new Qdrant("https://qdrant.example/", "secret", fetchMock);

        await qdrant.createCollection({ collectionName: "documents", size: 3 });

        expect(fetchMock).toHaveBeenCalledWith("https://qdrant.example/collections/documents", {
            method: "PUT",
            headers: { "Content-Type": "application/json", "api-key": "secret" },
            body: JSON.stringify({ vectors: { size: 3, distance: "Cosine" } }),
        });
    });

    it("upserts points and waits for acknowledgement by default", async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockResponse({ result: { status: "completed" } }));
        const qdrant = new Qdrant("https://qdrant.example", "", fetchMock);
        const points = [{ id: 1, vector: [0.1, 0.2], payload: { content: "hello" } }];

        await qdrant.upsertPoints({ collectionName: "my docs", points });

        expect(fetchMock).toHaveBeenCalledWith("https://qdrant.example/collections/my%20docs/points?wait=true", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ points }),
        });
    });

    it("searches points with payload and without vectors by default", async () => {
        const result = { result: [{ id: 1, score: 0.9 }] };
        const fetchMock = jest.fn().mockResolvedValue(mockResponse(result));
        const qdrant = new Qdrant("https://qdrant.example", "", fetchMock);

        await expect(qdrant.searchPoints({ collectionName: "documents", vector: [0.1, 0.2] })).resolves.toEqual(result);
        expect(fetchMock).toHaveBeenCalledWith("https://qdrant.example/collections/documents/points/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                vector: [0.1, 0.2],
                limit: 10,
                filter: undefined,
                with_payload: true,
                with_vector: false,
            }),
        });
    });

    it("retrieves and deletes selected points", async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockResponse({ result: [] }));
        const qdrant = new Qdrant("https://qdrant.example", "", fetchMock);

        await qdrant.getPointsByIds({ collectionName: "documents", ids: [1, "point-2"] });
        await qdrant.deletePointsByIds({ collectionName: "documents", ids: [1, "point-2"] });

        expect(fetchMock).toHaveBeenNthCalledWith(1, "https://qdrant.example/collections/documents/points", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [1, "point-2"], with_payload: true, with_vector: false }),
        });
        expect(fetchMock).toHaveBeenNthCalledWith(2, "https://qdrant.example/collections/documents/points/delete?wait=true", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ points: [1, "point-2"] }),
        });
    });

    it("surfaces Qdrant errors", async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockResponse({ status: { error: "missing collection" } }, false, 404));
        const qdrant = new Qdrant("https://qdrant.example", "", fetchMock);

        await expect(qdrant.deleteCollection({ collectionName: "missing" })).rejects.toThrow(
            'Qdrant request failed (404): {"status":{"error":"missing collection"}}'
        );
    });
});

import { Qdrant } from "../../lib/qdrant/qdrant.js";

describe("Qdrant Vector Database Client", () => {
    const mockUrl = "http://localhost:6333";
    const mockApiKey = "mock-qdrant-key";
    let qdrant: Qdrant;

    beforeEach(() => {
        qdrant = new Qdrant(mockUrl, mockApiKey);
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should initialize with custom URL and API key", () => {
        expect(qdrant.QDRANT_URL).toBe("http://localhost:6333");
        expect(qdrant.QDRANT_API_KEY).toBe("mock-qdrant-key");
    });

    it("should insert vector points into Qdrant", async () => {
        const mockResponse = { result: { status: "completed" }, status: "ok" };
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const points = [
            { id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "hello" } },
        ];

        const res = await qdrant.insertVectorData({
            collectionName: "test_collection",
            points,
        });

        expect(global.fetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/test_collection/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": "mock-qdrant-key",
                }),
                body: JSON.stringify({ points }),
            })
        );
        expect(res).toEqual(mockResponse);
    });

    it("should perform vector similarity search", async () => {
        const mockHits = [
            { id: 1, score: 0.95, payload: { text: "hello" } },
        ];
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockHits, status: "ok" }),
        });

        const res = await qdrant.getDataFromQuery({
            collectionName: "test_collection",
            vector: [0.1, 0.2, 0.3],
            limit: 5,
        });

        expect(global.fetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/test_collection/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 5,
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
        expect(res).toEqual(mockHits);
    });

    it("should fetch point by ID", async () => {
        const mockPoint = { id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "hello" } };
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockPoint, status: "ok" }),
        });

        const res = await qdrant.getDataById({
            collectionName: "test_collection",
            id: 1,
        });

        expect(global.fetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/test_collection/points/1",
            expect.objectContaining({ method: "GET" })
        );
        expect(res).toEqual(mockPoint);
    });

    it("should delete point by ID", async () => {
        const mockResponse = { result: { status: "completed" } };
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const res = await qdrant.deleteById({
            collectionName: "test_collection",
            id: 1,
        });

        expect(global.fetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/test_collection/points/delete",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ points: [1] }),
            })
        );
        expect(res).toEqual(mockResponse);
    });
});

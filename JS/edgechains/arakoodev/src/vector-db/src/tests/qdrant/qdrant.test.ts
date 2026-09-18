import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "https://mock-qdrant.local";
const MOCK_QDRANT_API_KEY = "mock-api-key";

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
    mockFetch.mockReset();
});

function mockQdrantResponse(result: any = { status: "ok" }) {
    mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result }),
    });
}

describe("Qdrant vector database", () => {
    it("should create a Qdrant client", () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        expect(client).toEqual({
            url: MOCK_QDRANT_URL,
            apiKey: MOCK_QDRANT_API_KEY,
            headers: {
                "Content-Type": "application/json",
                "api-key": MOCK_QDRANT_API_KEY,
            },
        });
    });

    it("should create a collection", async () => {
        mockQdrantResponse(true);
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
        });

        expect(mockFetch).toHaveBeenCalledWith(`${MOCK_QDRANT_URL}/collections/documents`, {
            method: "PUT",
            headers: client.headers,
            body: JSON.stringify({ vectors: { size: 1536, distance: "Cosine" } }),
        });
    });

    it("should upsert vector points", async () => {
        mockQdrantResponse({ operation_id: 1, status: "completed" });
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        const points = [
            {
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: { content: "hello" },
            },
        ];

        await qdrant.insertVectorData({
            client,
            collectionName: "documents",
            points,
        });

        expect(mockFetch).toHaveBeenCalledWith(
            `${MOCK_QDRANT_URL}/collections/documents/points?wait=true`,
            {
                method: "PUT",
                headers: client.headers,
                body: JSON.stringify({ points }),
            }
        );
    });

    it("should search vector points", async () => {
        const result = [{ id: 1, score: 0.99, payload: { content: "hello" } }];
        mockQdrantResponse(result);
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const response = await qdrant.search({
            client,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 5,
        });

        expect(response).toEqual(result);
        expect(mockFetch).toHaveBeenCalledWith(
            `${MOCK_QDRANT_URL}/collections/documents/points/search`,
            {
                method: "POST",
                headers: client.headers,
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 5,
                    with_payload: true,
                    with_vector: false,
                }),
            }
        );
    });

    it("should delete vector points", async () => {
        mockQdrantResponse({ operation_id: 2, status: "completed" });
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        await qdrant.deleteById({
            client,
            collectionName: "documents",
            ids: [1, 2],
        });

        expect(mockFetch).toHaveBeenCalledWith(
            `${MOCK_QDRANT_URL}/collections/documents/points/delete?wait=true`,
            {
                method: "POST",
                headers: client.headers,
                body: JSON.stringify({ points: [1, 2] }),
            }
        );
    });
});

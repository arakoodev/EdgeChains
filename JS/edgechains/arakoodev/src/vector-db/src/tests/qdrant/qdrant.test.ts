import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "https://mock-qdrant.local";
const MOCK_QDRANT_API_KEY = "mock-api-key";

describe("Qdrant", () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: jest.fn().mockResolvedValue(JSON.stringify({ result: "ok", status: "ok" })),
        });
        global.fetch = fetchMock;
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should create a client from constructor options", () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        expect(qdrant.createClient()).toEqual({
            url: MOCK_QDRANT_URL,
            apiKey: MOCK_QDRANT_API_KEY,
        });
    });

    it("should insert points through the Qdrant points upsert API", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        const points = [
            {
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: { content: "hello" },
            },
        ];

        await qdrant.insertVectorData({ client, collectionName: "documents", points });

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_QDRANT_URL}/collections/documents/points?wait=true`,
            expect.objectContaining({
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": MOCK_QDRANT_API_KEY,
                },
                body: JSON.stringify({ points }),
            })
        );
    });

    it("should search points through the Qdrant search API", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        await qdrant.getDataFromQuery({
            client,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: { must: [{ key: "category", match: { value: "docs" } }] },
        });

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_QDRANT_URL}/collections/documents/points/search`,
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 3,
                    filter: { must: [{ key: "category", match: { value: "docs" } }] },
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("should delete a point by id through the Qdrant delete API", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        await qdrant.deleteById({ client, collectionName: "documents", id: 123 });

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_QDRANT_URL}/collections/documents/points/delete?wait=true`,
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ points: [123] }),
            })
        );
    });
});

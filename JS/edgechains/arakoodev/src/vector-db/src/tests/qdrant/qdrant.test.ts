import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

jest.mock("axios");

describe("Qdrant Vector Database Client", () => {
    const qdrant = new Qdrant("http://localhost:6333", "test-qdrant-key");

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should create a collection via Qdrant REST API", async () => {
        (axios.put as jest.Mock).mockResolvedValueOnce({
            data: { result: true, status: "ok" },
        });

        const res = await qdrant.createCollection({
            collectionName: "edgechains_docs",
            vectorSize: 1536,
            distance: "Cosine",
        });

        expect(res).toEqual({ result: true, status: "ok" });
        expect(axios.put).toHaveBeenCalledWith(
            "http://localhost:6333/collections/edgechains_docs",
            { vectors: { size: 1536, distance: "Cosine" } },
            { headers: { "Content-Type": "application/json", "api-key": "test-qdrant-key" } }
        );
    });

    test("should upsert vector points via Qdrant REST API", async () => {
        (axios.put as jest.Mock).mockResolvedValueOnce({
            data: { result: { operation_id: 1, status: "completed" }, status: "ok" },
        });

        const res = await qdrant.insertVectorData({
            collectionName: "edgechains_docs",
            points: [{ id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "Hello Qdrant" } }],
        });

        expect(res.status).toBe("ok");
        expect(axios.put).toHaveBeenCalledWith(
            "http://localhost:6333/collections/edgechains_docs/points?wait=true",
            { points: [{ id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "Hello Qdrant" } }] },
            expect.any(Object)
        );
    });

    test("should search nearest neighbors via Qdrant REST API", async () => {
        const mockHits = [{ id: 1, score: 0.99, payload: { text: "Hello Qdrant" } }];
        (axios.post as jest.Mock).mockResolvedValueOnce({
            data: { result: mockHits, status: "ok" },
        });

        const hits = await qdrant.getDataFromQuery({
            collectionName: "edgechains_docs",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
        });

        expect(hits).toEqual(mockHits);
        expect(axios.post).toHaveBeenCalledWith(
            "http://localhost:6333/collections/edgechains_docs/points/search",
            {
                vector: [0.1, 0.2, 0.3],
                limit: 3,
                with_payload: true,
                with_vector: false,
            },
            expect.any(Object)
        );
    });

    test("should delete points by ID via Qdrant REST API", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({
            data: { result: { status: "completed" }, status: "ok" },
        });

        const res = await qdrant.deleteById({
            collectionName: "edgechains_docs",
            points: [1, 2],
        });

        expect(res.status).toBe("ok");
    });
});

import axios from "axios";
import {
    Qdrant,
    QdrantDistance,
} from "../../lib/qdrant/qdrant.js";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Qdrant Vector DB Service", () => {
    let qdrant: Qdrant;
    const mockGet = jest.fn();
    const mockPost = jest.fn();
    const mockPut = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.create.mockReturnValue({
            get: mockGet,
            post: mockPost,
            put: mockPut,
        } as any);

        qdrant = new Qdrant("http://localhost:6333", "test-api-key");
    });

    test("should initialize Qdrant instance", () => {
        expect(qdrant.QDRANT_URL).toBe("http://localhost:6333");
        expect(qdrant.QDRANT_API_KEY).toBe("test-api-key");
    });

    test("createCollection should send PUT request with vector config", async () => {
        mockPut.mockResolvedValueOnce({
            data: { result: true, status: "ok" },
        });

        const result = await qdrant.createCollection({
            collectionName: "test_coll",
            vectorSize: 1536,
            distance: QdrantDistance.COSINE,
        });

        expect(mockPut).toHaveBeenCalledWith("/collections/test_coll", {
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
        });
        expect(result.status).toBe("ok");
    });

    test("insertVectorData should send points payload with wait=true", async () => {
        mockPut.mockResolvedValueOnce({
            data: { result: { operation_id: 1, status: "completed" } },
        });

        const points = [
            {
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: { content: "test doc", author: "tester" },
            },
        ];

        const result = await qdrant.insertVectorData({
            collectionName: "test_coll",
            points,
        });

        expect(mockPut).toHaveBeenCalledWith(
            "/collections/test_coll/points?wait=true",
            { points }
        );
        expect(result.result.status).toBe("completed");
    });

    test("getDataFromQuery should perform vector search and return hits", async () => {
        const mockHits = [
            {
                id: 1,
                version: 0,
                score: 0.98,
                payload: { content: "found document" },
            },
        ];

        mockPost.mockResolvedValueOnce({
            data: { result: mockHits, status: "ok" },
        });

        const results = await qdrant.getDataFromQuery({
            collectionName: "test_coll",
            vector: [0.1, 0.2, 0.3],
            limit: 5,
        });

        expect(mockPost).toHaveBeenCalledWith(
            "/collections/test_coll/points/search",
            expect.objectContaining({
                vector: [0.1, 0.2, 0.3],
                limit: 5,
                with_payload: true,
                with_vector: false,
            })
        );
        expect(results).toHaveLength(1);
        expect(results[0].payload.content).toBe("found document");
    });

    test("getDataById should fetch point by id", async () => {
        mockGet.mockResolvedValueOnce({
            data: {
                result: {
                    id: 1,
                    payload: { content: "retrieved by id" },
                },
                status: "ok",
            },
        });

        const result = await qdrant.getDataById({
            collectionName: "test_coll",
            id: 1,
        });

        expect(mockGet).toHaveBeenCalledWith("/collections/test_coll/points/1");
        expect(result.id).toBe(1);
        expect(result.payload.content).toBe("retrieved by id");
    });

    test("deleteById should send delete points request", async () => {
        mockPost.mockResolvedValueOnce({
            data: { result: { status: "completed" }, status: "ok" },
        });

        const result = await qdrant.deleteById({
            collectionName: "test_coll",
            id: 1,
        });

        expect(mockPost).toHaveBeenCalledWith(
            "/collections/test_coll/points/delete?wait=true",
            { points: [1] }
        );
        expect(result.status).toBe("ok");
    });
});

import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

jest.mock("axios");

describe("Qdrant", () => {
    const url = "http://localhost:6333";
    const apiKey = "mock-api-key";

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("createCollection should PUT the collection with vector config", async () => {
        (axios.create as jest.Mock).mockReturnValue({
            put: jest.fn().mockResolvedValue({ data: { result: true, status: "ok" } }),
            post: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
        });

        const qdrant = new Qdrant(url, apiKey);
        const result = await qdrant.createCollection("test_collection", 1536, "Cosine");

        expect(axios.create).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: url,
                headers: { "api-key": apiKey },
            })
        );
        expect(qdrant.client.put).toHaveBeenCalledWith("/collections/test_collection", {
            vectors: { size: 1536, distance: "Cosine" },
        });
        expect(result).toEqual({ result: true, status: "ok" });
    });

    test("insertVectorData should upsert points", async () => {
        (axios.create as jest.Mock).mockReturnValue({
            put: jest.fn().mockResolvedValue({ data: { status: "completed", operation_id: 1 } }),
            post: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
        });

        const qdrant = new Qdrant(url);
        const points = [{ id: "1", vector: [0.1, 0.2], payload: { content: "hello" } }];
        const result = await qdrant.insertVectorData({ collectionName: "c", points });

        expect(qdrant.client.put).toHaveBeenCalledWith(
            "/collections/c/points",
            { points },
            { params: { wait: true } }
        );
        expect(result.status).toBe("completed");
    });

    test("search should return the result array", async () => {
        const resultArray = [{ id: "1", score: 0.9, payload: { content: "hello" } }];
        (axios.create as jest.Mock).mockReturnValue({
            put: jest.fn(),
            post: jest.fn().mockResolvedValue({ data: { result: resultArray } }),
            get: jest.fn(),
            delete: jest.fn(),
        });

        const qdrant = new Qdrant(url);
        const result = await qdrant.search({ collectionName: "c", vector: [0.1, 0.2], limit: 5 });

        expect(qdrant.client.post).toHaveBeenCalledWith("/collections/c/points/search", {
            vector: [0.1, 0.2],
            limit: 5,
            with_payload: true,
        });
        expect(result).toEqual(resultArray);
    });

    test("getDataById should GET a point", async () => {
        const point = { id: "1", vector: [0.1], payload: {} };
        (axios.create as jest.Mock).mockReturnValue({
            put: jest.fn(),
            post: jest.fn(),
            get: jest.fn().mockResolvedValue({ data: { result: point } }),
            delete: jest.fn(),
        });

        const qdrant = new Qdrant(url);
        const result = await qdrant.getDataById({ collectionName: "c", id: "1" });

        expect(qdrant.client.get).toHaveBeenCalledWith("/collections/c/points/1");
        expect(result).toEqual(point);
    });

    test("deleteById should POST a delete request", async () => {
        (axios.create as jest.Mock).mockReturnValue({
            put: jest.fn(),
            post: jest.fn().mockResolvedValue({ data: { result: { operation_id: 1 } } }),
            get: jest.fn(),
            delete: jest.fn(),
        });

        const qdrant = new Qdrant(url);
        const result = await qdrant.deleteById({ collectionName: "c", id: "1" });

        expect(qdrant.client.post).toHaveBeenCalledWith("/collections/c/points/delete", {
            points: ["1"],
        });
        expect(result).toEqual({ operation_id: 1 });
    });
});

import axios from "axios";
import { Qdrant } from "../lib/qdrant/qdrant";

jest.mock("axios");

describe("Qdrant", () => {
    let qdrant: Qdrant;

    beforeEach(() => {
        qdrant = new Qdrant({ url: "http://localhost:6333", apiKey: "test-key" });
        jest.clearAllMocks();
    });

    test("createCollection should send PUT request", async () => {
        const mockResponse = { data: { result: true, status: "ok" } };
        (axios.request as jest.Mock).mockResolvedValueOnce(mockResponse);

        const res = await qdrant.createCollection("test-collection", 128, "Cosine");

        expect(res).toEqual({ result: true, status: "ok" });
        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "put",
                url: "http://localhost:6333/collections/test-collection",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "test-key",
                },
                data: {
                    vectors: {
                        size: 128,
                        distance: "Cosine",
                    },
                },
            })
        );
    });

    test("upsertPoints should send PUT request with points", async () => {
        const mockResponse = { data: { result: { operation_id: 1, status: "completed" }, status: "ok" } };
        (axios.request as jest.Mock).mockResolvedValueOnce(mockResponse);

        const points = [
            { id: 1, vector: [0.1, 0.2], payload: { text: "hello" } },
        ];
        const res = await qdrant.upsertPoints("test-collection", points);

        expect(res).toEqual(mockResponse.data);
        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "put",
                url: "http://localhost:6333/collections/test-collection/points?wait=true",
                data: { points },
            })
        );
    });

    test("searchPoints should send POST request", async () => {
        const mockResponse = { data: { result: [{ id: 1, score: 0.99, payload: { text: "hello" } }] } };
        (axios.request as jest.Mock).mockResolvedValueOnce(mockResponse);

        const res = await qdrant.searchPoints("test-collection", [0.1, 0.2], 5);

        expect(res).toEqual(mockResponse.data);
        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "http://localhost:6333/collections/test-collection/points/search",
                data: {
                    vector: [0.1, 0.2],
                    limit: 5,
                },
            })
        );
    });

    test("deletePoints should send POST request", async () => {
        const mockResponse = { data: { result: { operation_id: 2, status: "completed" } } };
        (axios.request as jest.Mock).mockResolvedValueOnce(mockResponse);

        const res = await qdrant.deletePoints("test-collection", [1]);

        expect(res).toEqual(mockResponse.data);
        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "http://localhost:6333/collections/test-collection/points/delete?wait=true",
                data: {
                    ids: [1],
                },
            })
        );
    });

    test("deleteCollection should send DELETE request", async () => {
        const mockResponse = { data: { result: true, status: "ok" } };
        (axios.request as jest.Mock).mockResolvedValueOnce(mockResponse);

        const res = await qdrant.deleteCollection("test-collection");

        expect(res).toEqual(mockResponse.data);
        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "delete",
                url: "http://localhost:6333/collections/test-collection",
            })
        );
    });
});

import axios from "axios";
import { QdrantClient } from "../../../../../dist/db/src/lib/qdrant-client/QdrantClient.js";

jest.mock("axios");

describe("QdrantClient", () => {
    test("should search vectors", async () => {
        const mockResult = [{ id: 1, score: 0.9, payload: { text: "hello" } }];
        (axios.post as jest.Mock).mockResolvedValueOnce({ data: { result: mockResult } });
        const client = new QdrantClient({ url: "http://localhost:6333", collectionName: "test" });
        const results = await client.search([0.1, 0.2, 0.3], 5);
        expect(results).toEqual(mockResult);
    });

    test("should upsert points", async () => {
        (axios.put as jest.Mock).mockResolvedValueOnce({ data: { status: "ok" } });
        const client = new QdrantClient({ url: "http://localhost:6333", collectionName: "test" });
        const result = await client.upsert([{ id: 1, vector: [0.1, 0.2], payload: { text: "hi" } }]);
        expect(result).toEqual({ status: "ok" });
    });

    test("should create collection", async () => {
        (axios.put as jest.Mock).mockResolvedValueOnce({ data: { result: true } });
        const client = new QdrantClient({ url: "http://localhost:6333", collectionName: "test" });
        const result = await client.createCollection(384);
        expect(result).toEqual({ result: true });
    });
});

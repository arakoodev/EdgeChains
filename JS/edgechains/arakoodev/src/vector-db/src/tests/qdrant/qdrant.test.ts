import axios from "axios";

import { Qdrant } from "../../lib/qdrant/qdrant.js";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Qdrant", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("creates a collection through the Qdrant REST API", async () => {
        mockedAxios.put.mockResolvedValueOnce({ data: { result: true } });
        const qdrant = new Qdrant("https://qdrant.example", "test-key");

        const result = await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 1536,
        });

        expect(mockedAxios.put).toHaveBeenCalledWith(
            "https://qdrant.example/collections/documents",
            {
                vectors: {
                    size: 1536,
                    distance: "Cosine",
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "test-key",
                },
            }
        );
        expect(result).toEqual({ result: true });
    });

    test("upserts vector points without using a qdrant package", async () => {
        mockedAxios.put.mockResolvedValueOnce({ data: { status: "ok" } });
        const qdrant = new Qdrant("https://qdrant.example");

        await qdrant.insertVectorData({
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { content: "hello" },
                },
            ],
        });

        expect(mockedAxios.put).toHaveBeenCalledWith(
            "https://qdrant.example/collections/documents/points?wait=true",
            {
                points: [
                    {
                        id: 1,
                        vector: [0.1, 0.2, 0.3],
                        payload: { content: "hello" },
                    },
                ],
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    });

    test("searches vectors with payloads", async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                result: [{ id: 1, score: 0.98, payload: { content: "hello" } }],
            },
        });
        const qdrant = new Qdrant("https://qdrant.example");

        const result = await qdrant.search({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://qdrant.example/collections/documents/points/search",
            {
                vector: [0.1, 0.2, 0.3],
                limit: 3,
                filter: undefined,
                with_payload: true,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
        expect(result.result[0].score).toBe(0.98);
    });
});

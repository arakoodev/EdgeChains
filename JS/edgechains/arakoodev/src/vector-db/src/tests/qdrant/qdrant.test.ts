import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

const put = jest.fn();
const post = jest.fn();
const get = jest.fn();
const del = jest.fn();

jest.mock("axios", () => ({
    __esModule: true,
    default: {
        create: jest.fn(() => ({
            put,
            post,
            get,
            delete: del,
        })),
    },
}));

describe("Qdrant", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("creates an axios client with Qdrant cloud headers", () => {
        new Qdrant({
            url: "https://example.qdrant.cloud/",
            apiKey: "test-key",
        });

        expect(axios.create).toHaveBeenCalledWith({
            baseURL: "https://example.qdrant.cloud",
            headers: {
                "Content-Type": "application/json",
                "api-key": "test-key",
            },
        });
    });

    it("creates a collection through the REST API", async () => {
        put.mockResolvedValueOnce({ data: { result: true } });
        const qdrant = new Qdrant({ url: "http://localhost:6333" });

        const result = await qdrant.createCollection({
            collectionName: "documents",
            config: {
                vectors: {
                    size: 1536,
                    distance: "Cosine",
                },
            },
        });

        expect(put).toHaveBeenCalledWith("/collections/documents", {
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
        });
        expect(result).toEqual({ result: true });
    });

    it("upserts vector points without a Qdrant SDK", async () => {
        put.mockResolvedValueOnce({ data: { result: { operation_id: 1 } } });
        const qdrant = new Qdrant({ url: "http://localhost:6333" });

        await qdrant.upsertPoints({
            collectionName: "documents",
            points: [
                {
                    id: "doc-1",
                    vector: [0.1, 0.2, 0.3],
                    payload: { text: "hello" },
                },
            ],
        });

        expect(put).toHaveBeenCalledWith(
            "/collections/documents/points",
            {
                points: [
                    {
                        id: "doc-1",
                        vector: [0.1, 0.2, 0.3],
                        payload: { text: "hello" },
                    },
                ],
            },
            { params: { wait: true } }
        );
    });

    it("searches vector points and returns Qdrant results", async () => {
        post.mockResolvedValueOnce({
            data: {
                result: [{ id: "doc-1", score: 0.98, payload: { text: "hello" } }],
            },
        });
        const qdrant = new Qdrant({ url: "http://localhost:6333" });

        const result = await qdrant.searchPoints({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 1,
            with_payload: true,
        });

        expect(post).toHaveBeenCalledWith("/collections/documents/points/search", {
            vector: [0.1, 0.2, 0.3],
            limit: 1,
            with_payload: true,
        });
        expect(result).toEqual([{ id: "doc-1", score: 0.98, payload: { text: "hello" } }]);
    });

    it("retrieves and deletes points through REST endpoints", async () => {
        post.mockResolvedValueOnce({ data: { result: [{ id: "doc-1" }] } });
        post.mockResolvedValueOnce({ data: { result: { status: "acknowledged" } } });
        const qdrant = new Qdrant({ url: "http://localhost:6333" });

        await expect(
            qdrant.retrievePoints({ collectionName: "documents", ids: ["doc-1"] })
        ).resolves.toEqual([{ id: "doc-1" }]);
        await qdrant.deletePoints({ collectionName: "documents", ids: ["doc-1"] });

        expect(post).toHaveBeenNthCalledWith(1, "/collections/documents/points", {
            ids: ["doc-1"],
            with_payload: true,
            with_vector: false,
        });
        expect(post).toHaveBeenNthCalledWith(
            2,
            "/collections/documents/points/delete",
            {
                points: ["doc-1"],
            },
            { params: { wait: true } }
        );
    });
});

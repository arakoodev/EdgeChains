import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

vi.mock("axios");

const MOCK_QDRANT_URL = "https://mock-qdrant.cloud";
const MOCK_QDRANT_API_KEY = "mock-api-key";

describe("Qdrant", () => {
    const put = vi.fn();
    const post = vi.fn();
    const get = vi.fn();
    const deleteFn = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(axios.create).mockReturnValue({
            put,
            post,
            get,
            delete: deleteFn,
        });
    });

    it("should create an axios client with Qdrant headers", () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        qdrant.createClient();

        expect(axios.create).toHaveBeenCalledWith({
            baseURL: MOCK_QDRANT_URL,
            headers: {
                "Content-Type": "application/json",
                "api-key": MOCK_QDRANT_API_KEY,
            },
        });
    });

    it("should create a collection", async () => {
        put.mockResolvedValue({ data: { result: true } });
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const result = await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectors: {
                size: 1536,
                distance: "Cosine",
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

    it("should upsert points", async () => {
        put.mockResolvedValue({ data: { status: "ok" } });
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const result = await qdrant.upsertPoints({
            client,
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { content: "hello" },
                },
            ],
        });

        expect(put).toHaveBeenCalledWith("/collections/documents/points", {
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { content: "hello" },
                },
            ],
            wait: true,
        });
        expect(result).toEqual({ status: "ok" });
    });

    it("should search points", async () => {
        post.mockResolvedValue({ data: { result: [{ id: 1, score: 0.99 }] } });
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const result = await qdrant.searchPoints({
            client,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            withPayload: true,
        });

        expect(post).toHaveBeenCalledWith("/collections/documents/points/search", {
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: undefined,
            with_payload: true,
            with_vector: false,
            score_threshold: undefined,
        });
        expect(result).toEqual({ result: [{ id: 1, score: 0.99 }] });
    });

    it("should delete points", async () => {
        post.mockResolvedValue({ data: { result: true } });
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();

        const result = await qdrant.deletePoints({
            client,
            collectionName: "documents",
            points: [1, 2],
        });

        expect(post).toHaveBeenCalledWith("/collections/documents/points/delete", {
            points: [1, 2],
            wait: true,
        });
        expect(result).toEqual({ result: true });
    });
});

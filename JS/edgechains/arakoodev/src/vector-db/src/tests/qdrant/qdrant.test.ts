import axios from "axios";
import { beforeEach, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

const mocks = vi.hoisted(() => ({
    create: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
}));

vi.mock("axios", () => ({
    default: {
        create: mocks.create,
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockReturnValue({ put: mocks.put, post: mocks.post });
    mocks.put.mockResolvedValue({ data: { status: "ok" } });
    mocks.post.mockResolvedValue({ data: { result: [] } });
});

it("creates a REST client with an api key header", () => {
    const qdrant = new Qdrant({
        url: "http://localhost:6333/",
        apiKey: "test-key",
    });

    qdrant.createClient();

    expect(axios.create).toHaveBeenCalledWith({
        baseURL: "http://localhost:6333",
        headers: {
            "api-key": "test-key",
        },
    });
});

it("creates collections with vector configuration", async () => {
    const qdrant = new Qdrant({ url: "http://localhost:6333" });
    const client = qdrant.createClient();

    await qdrant.createCollection({
        client,
        collectionName: "documents",
        vectors: {
            size: 1536,
            distance: "Cosine",
        },
    });

    expect(mocks.put).toHaveBeenCalledWith("/collections/documents", {
        vectors: {
            size: 1536,
            distance: "Cosine",
        },
    });
});

it("upserts points through the Qdrant REST API", async () => {
    const qdrant = new Qdrant({ url: "http://localhost:6333" });
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

    expect(mocks.put).toHaveBeenCalledWith(
        "/collections/documents/points",
        { points },
        { params: { wait: true } }
    );
});

it("searches points using the provided vector and filter", async () => {
    const qdrant = new Qdrant({ url: "http://localhost:6333" });
    const client = qdrant.createClient();

    await qdrant.getDataFromQuery({
        client,
        collectionName: "documents",
        vector: [0.1, 0.2, 0.3],
        filter: {
            must: [
                {
                    key: "source",
                    match: { value: "docs" },
                },
            ],
        },
        limit: 3,
    });

    expect(mocks.post).toHaveBeenCalledWith("/collections/documents/points/search", {
        vector: [0.1, 0.2, 0.3],
        limit: 3,
        filter: {
            must: [
                {
                    key: "source",
                    match: { value: "docs" },
                },
            ],
        },
        with_payload: true,
        with_vector: false,
        score_threshold: undefined,
    });
});

it("retrieves and deletes points by id", async () => {
    const qdrant = new Qdrant({ url: "http://localhost:6333" });
    const client = qdrant.createClient();

    await qdrant.getDataById({
        client,
        collectionName: "documents",
        ids: [1, "external-id"],
    });
    await qdrant.deleteById({
        client,
        collectionName: "documents",
        ids: [1, "external-id"],
    });

    expect(mocks.post).toHaveBeenNthCalledWith(1, "/collections/documents/points", {
        ids: [1, "external-id"],
        with_payload: true,
        with_vector: false,
    });
    expect(mocks.post).toHaveBeenNthCalledWith(
        2,
        "/collections/documents/points/delete",
        {
            points: [1, "external-id"],
        },
        { params: { wait: true } }
    );
});

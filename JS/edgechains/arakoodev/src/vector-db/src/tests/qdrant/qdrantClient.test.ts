import { QdrantClient } from "../../../../../dist/vector-db/src/lib/qdrant/QdrantClient.js";

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPost = jest.fn();
const mockAxiosCreate: jest.Mock = jest.fn(() => ({
    get: mockGet,
    put: mockPut,
    post: mockPost,
}));

jest.mock("axios", () => ({
    __esModule: true,
    default: {
        create: (config: any) => mockAxiosCreate(config),
    },
}));

describe("QdrantClient", () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockPut.mockReset();
        mockPost.mockReset();
        mockAxiosCreate.mockClear();
    });

    test("constructor should set baseURL and api-key header when provided", () => {
        new QdrantClient({
            url: "http://localhost:6333/",
            apiKey: "secret",
            timeoutMs: 1234,
        });

        expect(mockAxiosCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: "http://localhost:6333",
                timeout: 1234,
                headers: { "api-key": "secret" },
            })
        );
    });

    test("searchPoints should call Qdrant search endpoint and return result list", async () => {
        mockPost.mockResolvedValueOnce({
            data: {
                result: [{ id: 1, score: 0.99, payload: { foo: "bar" } }],
            },
        });

        const client = new QdrantClient({ url: "http://localhost:6333" });
        const res = await client.searchPoints({
            collectionName: "my_collection",
            vector: [0.1, 0.2],
            limit: 3,
            withPayload: true,
            withVector: false,
        });

        expect(mockPost).toHaveBeenCalledWith(
            "/collections/my_collection/points/search",
            expect.objectContaining({
                vector: [0.1, 0.2],
                limit: 3,
                with_payload: true,
                with_vector: false,
            })
        );
        expect(res).toEqual([{ id: 1, score: 0.99, payload: { foo: "bar" } }]);
    });
});

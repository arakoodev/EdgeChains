import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "https://mock-qdrant.co";

jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: jest.fn().mockImplementation(() => ({
            createClient: jest.fn(() => ({
                upsert: jest.fn().mockResolvedValue({ status: "completed" }),
            })),
            insertVectorData: jest.fn().mockImplementation(async ({ tableName, embedding }) => {
                return {
                    status: "completed",
                    tableName: tableName,
                    data: [{ embedding }],
                };
            }),
        })),
    };
});

it("should insert data into Qdrant", async () => {
    let qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    const client = qdrant.createClient();
    const tableName = "test_collection";
    
    const result = await qdrant.insertVectorData({
        client,
        tableName,
        embedding: Array.from({ length: 1536 }, (_, i) => i),
    });

    expect(result).toEqual(
        expect.objectContaining({
            status: "completed",
            tableName: tableName,
        })
    );
}, 10000);

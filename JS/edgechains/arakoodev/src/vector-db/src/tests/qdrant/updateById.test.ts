import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-qdrant-api-key";

describe("Qdrant updateById", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should update payload by id in Qdrant via REST POST /collections/{name}/points/payload", async () => {
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: {
                result: { operation_id: 2, status: "completed" },
                status: "ok",
            },
        });

        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const updatedContent = { name: "Updated Name" };
        const res = await qdrant.updateById({
            tableName: "documents",
            id: 546,
            updatedContent,
        });

        expect(res).toEqual(expect.objectContaining({ id: 546, name: "Updated Name" }));
        expect(mockedAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "http://localhost:6333/collections/documents/points/payload?wait=true",
                data: {
                    payload: updatedContent,
                    points: [546],
                },
            })
        );
    });
});

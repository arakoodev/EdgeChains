import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-qdrant-api-key";

describe("Qdrant deleteById", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should delete point by id from Qdrant via REST POST /collections/{name}/points/delete", async () => {
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: {
                result: { operation_id: 3, status: "completed" },
                status: "ok",
            },
        });

        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const res = await qdrant.deleteById({
            tableName: "documents",
            id: 549,
        });

        expect(res).toEqual(
            expect.objectContaining({
                status: 200,
                message: "Deleted successfully",
            })
        );
        expect(mockedAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "http://localhost:6333/collections/documents/points/delete?wait=true",
                data: {
                    points: [549],
                },
            })
        );
    });
});

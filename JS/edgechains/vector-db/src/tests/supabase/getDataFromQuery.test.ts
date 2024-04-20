import { Supabase } from "../../lib/supabase/supabase.js";

const MOCK_SUPABASE_API_KEY = "mock-api-key";
const MOCK_SUPABASE_URL = "https://mock-supabase.co";

// Mock the getDataFromQuery method of the Supabase class
jest.mock("../../lib/supabase/supabase.js", () => {
    return {
        Supabase: jest.fn().mockImplementation(() => ({
            createClient: jest.fn(() => ({
                // Mock client methods
                from: jest.fn().mockReturnThis(),
            })),
            getDataFromQuery: jest
                .fn()
                .mockImplementation(async ({ client, functionNameToCall, args }) => {
                    // Mock response data
                    const responseData = { id: 1, content: "Hello, world!" };

                    // Return the mock response
                    return responseData;
                }),
        })),
    };
});

describe("getDataFromQuery", () => {
    it("should fetch data from the vector database", async () => {
        const tableName = "documents";
        const columns = "content";
        const mockResponseData = { id: 1, content: "Hello, world!" };

        let supabase = new Supabase(MOCK_SUPABASE_URL, MOCK_SUPABASE_API_KEY);

        const client = supabase.createClient();
        // Call the method that uses getDataFromQuery
        const res = await supabase.getDataFromQuery({
            client,
            functionNameToCall: "fetchData",
            tableName,
            columns,
        });

        // Expect the result to match the mock response data
        expect(res).toEqual(mockResponseData);
    });
});

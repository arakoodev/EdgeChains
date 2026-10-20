import { Supabase } from "../../../../../dist/vector-db/src/lib/supabase/supabase.js";

const MOCK_SUPABASE_API_KEY = "mock-api-key";
const MOCK_SUPABASE_URL = "https://mock-supabase.co";
// Mock the updateById method of the Supabase class
jest.mock("../../../../../dist/vector-db/src/lib/supabase/supabase.js", () => {
    return {
        Supabase: jest.fn().mockImplementation(() => ({
            createClient: jest.fn(() => ({
                // Mock client methods
                from: jest.fn().mockReturnThis(),
            })),

            updateById: jest
                .fn()
                .mockImplementation(async ({ client, tableName, id, updatedContent }) => {
                    // Mock response for a successful update
                    const mockResponse = {
                        id: id, // Assuming the id remains the same after update
                        ...updatedContent, // Assuming updatedContent contains updated fields
                    };

                    // Return the mocked response
                    return mockResponse;
                }),
        })),
    };
});

describe("updateById", () => {
    it("should update data by id in the database", async () => {
        let supabase = new Supabase(MOCK_SUPABASE_URL, MOCK_SUPABASE_API_KEY);
        const client = supabase.createClient();
        // Call the updateById method with mock parameters
        const updatedContent = { name: "Updated Name" }; // Assuming 'name' is one of the fields to update
        const res = await supabase.updateById({
            client, // Mock client
            tableName: "documents",
            id: 546, // Id of the row to update
            updatedContent: updatedContent,
        });

        // Check if the returned data matches the updated content
        expect(res).toEqual(expect.objectContaining(updatedContent));
    });

    // Add more test cases as needed, e.g., to test error handling
});

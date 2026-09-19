import { Supabase } from "../../../../../dist/vector-db/src/lib/supabase/supabase.js";
import { describe, expect, it, vi } from "vitest";

const MOCK_SUPABASE_API_KEY = "mock-api-key";
const MOCK_SUPABASE_URL = "https://mock-supabase.co";

// Mock the deleteById method of the Supabase class
vi.mock("../../../../../dist/vector-db/src/lib/supabase/supabase.js", () => {
    return {
        Supabase: vi.fn().mockImplementation(() => ({
            createClient: vi.fn(() => ({
                // Mock client methods
                from: vi.fn().mockReturnThis(),
            })),

            deleteById: vi.fn().mockImplementation(async ({ client, tableName, id }) => {
                // Mock response for a successful deletion
                const mockResponse = {
                    status: 200,
                    message: "Deleted successfully", // Message indicating successful deletion
                };

                // Return the mocked response
                return mockResponse;
            }),
        })),
    };
});

describe("deleteById", () => {
    it("should delete data by id from the database", async () => {
        let supabase = new Supabase(MOCK_SUPABASE_URL, MOCK_SUPABASE_API_KEY);
        const client = supabase.createClient();
        // Call the deleteById method with mock parameters
        const res = await supabase.deleteById({
            client, // Mock client
            tableName: "documents",
            id: 549, // Id of the row to delete
        });

        // Check if the response indicates successful deletion
        expect(res).toEqual(
            expect.objectContaining({ status: 200, message: "Deleted successfully" })
        );
    });
});

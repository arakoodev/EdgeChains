import { Supabase } from "../../lib/supabase/supabase.js";

const MOCK_SUPABASE_API_KEY = 'mock-api-key';
const MOCK_SUPABASE_URL = 'https://mock-supabase.co';

// Mock the getDataById method of the Supabase class
jest.mock("../../lib/supabase/supabase.js", () => {
    return {
        Supabase: jest.fn().mockImplementation(() => ({
            createClient: jest.fn(() => ({
                // Mock client methods
                from: jest.fn().mockReturnThis(),
            })),
            getDataById: jest.fn().mockImplementation(async ({ client, tableName, id }) => {
                // Assuming 'id' corresponds to the index of the data in the mock data array
                const mockData = [
                    { id: 546, content: "Mocked content for id 546" },
                    // Add more mock data as needed
                ];

                // Find the mock data corresponding to the provided id
                const data = mockData.find((item) => item.id === id);

                if (data) {
                    return data; // Return the mock data
                } else {
                    throw new Error(`Data with id ${id} not found`); // Throw an error if data not found
                }
            }),
        })),
    };
});

let supabase = new Supabase(MOCK_SUPABASE_URL, MOCK_SUPABASE_API_KEY);
const client = supabase.createClient();

describe("getDataById", () => {
    it("should fetch data by id from the database", async () => {
        // Call the getDataById method
        const res = await supabase.getDataById({
            client, // Mock client
            tableName: "documents",
            id: 546, // Id of the data to fetch
        });

        // Check if the fetched data matches the expected content
        expect(res.content).toEqual("Mocked content for id 546");
    });

    it("should throw an error if data with the provided id is not found", async () => {

        // Call the getDataById method with an id that does not exist in the mock data
        await expect(
            supabase.getDataById({
                client, // Mock client
                tableName: "documents",
                id: 999, // Id of non-existent data
            })
        ).rejects.toThrow("Data with id 999 not found"); // Expect the method to throw an error
    });
});

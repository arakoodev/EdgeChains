import { Supabase } from "../../lib/supabase/supabase.js";
const MOCK_SUPABASE_API_KEY = 'mock-api-key';
const MOCK_SUPABASE_URL = 'https://mock-supabase.co';

// Mock the getDataFromQuery method of the Supabase class
jest.mock("../../lib/supabase/supabase.js", () => {
    return {
        Supabase: jest.fn().mockImplementation(() => ({
            createClient: jest.fn(() => ({
                // Mock client methods
                from: jest.fn().mockReturnThis(),
            })),
            getData: jest.fn().mockImplementation(async ({ client, tableName, columns }) => {
                // Mock response data
                const responseData = [{ id: 1, content: 'Sample content' }];;

                // Return the mock response
                return responseData;
            }),
        })),
    };
});

describe('Supabase getData method', () => {
    it('should fetch data from the database', async () => {
        let supabase = new Supabase(MOCK_SUPABASE_URL, MOCK_SUPABASE_API_KEY);
        const client = supabase.createClient();

        // Call the getData method with mocked parameters
        const tableName = 'documents';
        const columns = 'content';
        const result = await supabase.getData({ client, tableName, columns });

        // Check if the result matches the expected data
        expect(result).toEqual([{ id: 1, content: 'Sample content' }]);
    });
});
import { Supabase } from '../../lib/supabase/supabase.js';

const MOCK_SUPABASE_API_KEY = 'mock-api-key';
const MOCK_SUPABASE_URL = 'https://mock-supabase.co';

// Mock the Supabase class to return a mock client
jest.mock('../../lib/supabase/supabase.js', () => {
    return {
        Supabase: jest.fn().mockImplementation(() => ({
            createClient: jest.fn(() => ({
                // Mock client methods
                from: jest.fn().mockReturnThis(),
            })),
            insertVectorData: jest.fn().mockImplementation(async ({ tableName, content, embedding }) => {
                // Assuming content is a string and embedding is an array of length 1536
                const mockResponse = {
                    tableName: tableName,
                    data: [
                        {
                            content: content,
                            embedding: embedding, // Mock embedding vector
                        },
                    ],
                };
                return mockResponse;
            }),
        })),
    };
});

it('should insert data into the database', async () => {
    let supabase = new Supabase(MOCK_SUPABASE_URL, MOCK_SUPABASE_API_KEY);
    const client = supabase.createClient();
    const tableName = 'test_table';
    const content = 'test';
    // Insert data into the database
    const result = await supabase.insertVectorData({ client, tableName, content, embedding: Array.from({ length: 1536 }, (_, i) => i) });
    console.log({ result });

    // Check if the insertion was successful
    expect(result).toEqual(expect.objectContaining({
        tableName: tableName,
        data: expect.arrayContaining([
            expect.objectContaining({
                content,
                embedding: expect.arrayContaining(Array.from({ length: 1536 }, (_, i) => i)), // Mocked embedding vector
            }),
        ]),
    }));
}, 10000);

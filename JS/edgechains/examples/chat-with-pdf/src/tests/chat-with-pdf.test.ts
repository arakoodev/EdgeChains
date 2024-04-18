import { ChatRouter } from '../routes/chat.js'; // Import the ChatRouter
import { Supabase } from '@arakoodev/vector-db'; // Import Supabase

jest.mock('@arakoodev/vector-db', () => ({
  Supabase: jest.fn().mockImplementation(() => ({
    createClient: jest.fn().mockReturnValue({
      getDataFromQuery: jest.fn().mockResolvedValue([]), // Mock the getDataFromQuery method
    }),
  })),
}));

describe('ChatRouter', () => {
  afterEach(() => {
    jest.clearAllMocks(); // Clear mock function calls after each test
  });

  test('GET / should return response', async () => {
    // Mock request context
    const mockCtx = {
      req: {
        query: jest.fn().mockReturnValue({ question: 'test question' }), // Mock query parameter
      },
      json: jest.fn(), // Mock json method
    };

    // Execute the route handler
    await ChatRouter.get(mockCtx);

    // Assertions
    expect(mockCtx.req.query).toHaveBeenCalledWith('question'); // Check if query method was called with the correct parameter
    expect(Supabase).toHaveBeenCalled(); // Check if Supabase constructor was called
    expect(mockCtx.json).toHaveBeenCalledWith({ res: 'mocked response' }); // Check if json method was called with the correct response
  });

  // Add more test cases as needed
});

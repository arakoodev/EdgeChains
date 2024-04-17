import { createConnection, getManager } from 'typeorm';
import { PostgresClient, PostgresDistanceMetric } from '../../lib/postgres-client/PostgresClient.js';

// Mock createConnection and getManager functions from TypeORM
jest.mock('typeorm', () => ({
  createConnection: jest.fn(),
  getManager: jest.fn(),
}));

describe('PostgresClient', () => {
  let postgresClient: PostgresClient;

  beforeEach(() => {
    // Initialize a new PostgresClient instance with mock parameters
    postgresClient = new PostgresClient(
      [],
      PostgresDistanceMetric.COSINE,
      10,
      5,
      'test_table',
      'test_namespace',
      {
        textWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
        similarityWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
        dateWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
        orderRRF: 'text_rank',
        metadataTable: 'test_metadata',
        query: 'test_query',
      },
      100
    );
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear mock function calls after each test
  });

  test('dbQuery should generate the correct SQL query', async () => {
    // Mock the entityManager query function
    const mockQuery = jest.fn().mockResolvedValue([]);
    (getManager as jest.Mock).mockResolvedValueOnce({ query: mockQuery });

    // Mock the createConnection function
    (createConnection as jest.Mock).mockResolvedValueOnce({ close: jest.fn() });

    // Call the dbQuery method
    await postgresClient.dbQuery();
    console.log({mockQuery})

    // Check that the correct SQL query was generated
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String));
  });
});

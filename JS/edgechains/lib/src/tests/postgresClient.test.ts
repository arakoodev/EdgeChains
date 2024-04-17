import { createConnection, getManager } from 'typeorm';
import { PostgresClient, PostgresDistanceMetric } from '../lib/clients/PostgresClient.js';

jest.mock('typeorm', () => ({
  createConnection: jest.fn(),
  getManager: jest.fn(),
}));

describe('PostgresClient', () => {
  describe('dbQuery', () => {
    test('should perform database query with correct parameters', async () => {
      // Mocked values
      const wordEmbeddings = [[1, 2, 3], [4, 5, 6]];
      const metric = PostgresDistanceMetric.COSINE;
      const topK = 10;
      const probes = 5;
      const tableName = 'test_table';
      const namespace = 'test_namespace';
      const arkRequest = { textWeight: { baseWeight: 1, fineTuneWeight: 1 }, similarityWeight: { baseWeight: 1, fineTuneWeight: 1 }, dateWeight: { baseWeight: 1, fineTuneWeight: 1 }, query: 'test_query', orderRRF: 'text_rank', metadataTable: 'test_metadata_table' };
      const upperLimit = 100;

      // Mock createConnection and getManager
      const mockConnection = { close: jest.fn() };
      createConnection.mockResolvedValue(mockConnection);
      const mockEntityManager = { query: jest.fn() };
      getManager.mockResolvedValue(mockEntityManager);

      // Create instance of PostgresClient
      const postgresClient = new PostgresClient(wordEmbeddings, metric, topK, probes, tableName, namespace, arkRequest, upperLimit);

      // Expected query string
      // (You need to build your expected query string based on the input parameters)

      // Call dbQuery method
      await postgresClient.dbQuery();

      // Assertions
      expect(createConnection).toHaveBeenCalledTimes(1);
      expect(getManager).toHaveBeenCalledTimes(1);
      // Add more assertions as needed
    });
  });
});

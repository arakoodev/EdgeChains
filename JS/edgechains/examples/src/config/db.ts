import { createConnection, Connection, getManager, EntityManager } from 'typeorm';

class DatabaseConnection {
  private static connection: Connection | undefined;

  public static async establishDatabaseConnection(): Promise<Connection> {
    if (!DatabaseConnection.connection) {
      DatabaseConnection.connection = await createConnection();
    }
    return DatabaseConnection.connection;
  }

  public static async getEntityManager(): Promise<EntityManager> {
    await DatabaseConnection.establishDatabaseConnection();
    return getManager();
  }
}

export default DatabaseConnection;

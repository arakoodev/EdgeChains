// File: edgechains/lib/src/lib/clients/VectorDBClient.ts
export interface VectorDBClient {
  /** Ensure the collection exists (create if needed) */
  ensureCollection(collectionName: string, vectorSize: number): Promise<void>;

  /** Insert or update vectors */
  upsert(
    collectionName: string,
    points: Array<{ id: string | number; vector: number[]; payload?: Record<string, any> }>
  ): Promise<void>;

  /** Perform a similarity search */
  search(
    collectionName: string,
    queryVector: number[],
    limit: number,
    filter?: Record<string, any>
  ): Promise<Array<{ id: string | number; score: number; payload?: Record<string, any> }>>;

  /** Delete points by id */
  delete(collectionName: string, ids: Array<string | number>): Promise<void>;
}
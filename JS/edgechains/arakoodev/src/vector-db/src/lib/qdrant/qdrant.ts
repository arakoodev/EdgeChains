import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

interface ArgsObject {
  [key: string]: any;
}

interface QdrantPoint {
  id: number | string;
  vector: number[];
  payload?: ArgsObject;
}

interface CreateCollectionArgs {
  client: AxiosInstance;
  collectionName: string;
  vectorSize: number;
  distance?: QdrantDistanceMetric;
  [key: string]: any; // Allow dynamic properties
}

interface InsertVectorDataArgs {
  client: AxiosInstance;
  collectionName: string;
  points: QdrantPoint[];
  [key: string]: any; // Allow dynamic properties
}

interface GetDataFromQueryArgs {
  client: AxiosInstance;
  collectionName: string;
  queryVector: number[];
  limit?: number;
  filter?: ArgsObject;
  [key: string]: any;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY: string;

  constructor(QDRANT_URL: string, QDRANT_API_KEY: string) {
    this.QDRANT_URL =
      QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333";
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY!;
  }

  // Function to create a Qdrant client (axios instance pre-configured
  // with the Qdrant base URL and api-key header). Qdrant is spoken to
  // through its REST API directly, no Qdrant packages are used.
  createClient() {
    return axios.create({
      baseURL: this.QDRANT_URL,
      headers: {
        "Content-Type": "application/json",
        ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
      },
    });
  }

  // Extract the error message out of a failed Qdrant REST call.
  private qdrantError(error: any): Error {
    const qdrantMessage = error?.response?.data?.status?.error;
    if (qdrantMessage) {
      return new Error(
        `Qdrant request failed with error message "${qdrantMessage}"`,
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Create a collection in the Qdrant vector database.
   * A collection has to exist before points can be inserted into it.
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection to create.
   * @param vectorSize The size (dimensions) of the vectors stored in the collection.
   * @param distance The distance metric used to compare vectors (Cosine by default).
   * @returns The Qdrant response if successful.
   * @throws Error if creation fails.
   */
  async createCollection({
    client,
    collectionName,
    vectorSize,
    distance = QdrantDistanceMetric.COSINE,
  }: CreateCollectionArgs): Promise<any> {
    try {
      const res = await client.put(`/collections/${collectionName}`, {
        vectors: {
          size: vectorSize,
          distance: distance,
        },
      });
      return res.data;
    } catch (error: any) {
      console.error("Error creating collection in vector database:", error);
      throw this.qdrantError(error);
    }
  }

  /**
   * Delete a collection from the Qdrant vector database.
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection to delete.
   * @returns The Qdrant response if successful.
   * @throws Error if deletion fails.
   */
  async deleteCollection({
    client,
    collectionName,
  }: {
    client: AxiosInstance;
    collectionName: string;
  }): Promise<any> {
    try {
      const res = await client.delete(`/collections/${collectionName}`);
      return res.data;
    } catch (error: any) {
      console.error("Error deleting collection from vector database:", error);
      throw this.qdrantError(error);
    }
  }

  /**
   * Insert data into a vector database using a Qdrant client.
   * Points are upserted: a point whose id already exists is overwritten.
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection to insert data into.
   * @param points The points to insert, each with an id, a vector and an optional payload.
   * @returns The Qdrant response if successful.
   * @throws Error if insertion fails.
   */
  async insertVectorData({
    client,
    collectionName,
    points,
  }: InsertVectorDataArgs): Promise<any> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: 5,
        factor: 3,
        minTimeout: 1 * 1000,
        maxTimeout: 60 * 1000,
        randomize: true,
      });

      operation.attempt(async (currentAttempt) => {
        try {
          const res = await client.put(
            `/collections/${collectionName}/points?wait=true`,
            { points: points },
          );
          if (res.data?.status === "ok") {
            resolve(res.data);
          } else {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to insert ${JSON.stringify(points)} with error message "${res.data?.status?.error}"`,
              ),
            );
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(this.qdrantError(error));
        }
      });
    });
  }

  /**
   * Search the vector database for the points closest to a query vector.
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection to search in.
   * @param queryVector The embedding vector to search with.
   * @param limit The maximum number of points to return.
   * @param filter An optional Qdrant filter to restrict the search.
   * @returns The fetched points (id, score and payload) if successful.
   * @throws Error if fetching fails.
   */
  async getDataFromQuery({
    client,
    collectionName,
    queryVector,
    limit = 10,
    filter,
  }: GetDataFromQueryArgs): Promise<any> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: 5,
        factor: 3,
        minTimeout: 1 * 1000,
        maxTimeout: 60 * 1000,
        randomize: true,
      });

      operation.attempt(async (currentAttempt) => {
        try {
          let res = await client.post(
            `/collections/${collectionName}/points/search`,
            {
              vector: queryVector,
              limit: limit,
              with_payload: true,
              ...(filter ? { filter: filter } : {}),
            },
          );
          if (res.status == 200) {
            resolve(res.data.result);
          } else {
            if (operation.retry(new Error())) return;
            reject(
              new Error(
                `Failed with ErrorCode:${res.status} and ErrorMessage:${res.data?.status?.error}`,
              ),
            );
          }
        } catch (error: any) {
          if (operation.retry(error)) return;
          reject(this.qdrantError(error));
        }
      });
    });
  }

  /**
   * Fetch data from your database (scrolls through the points of a collection)
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection you want to get your data from
   * @param limit The maximum number of points to return
   * @returns The fetched data if successful.
   * @throws Error if fetching fails.
   */
  async getData({
    client,
    collectionName,
    limit = 10,
  }: {
    client: AxiosInstance;
    collectionName: string;
    limit?: number;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: 5,
        factor: 3,
        minTimeout: 1 * 1000,
        maxTimeout: 60 * 1000,
        randomize: true,
      });

      operation.attempt(async (currentAttempt) => {
        try {
          const res = await client.post(
            `/collections/${collectionName}/points/scroll`,
            {
              limit: limit,
              with_payload: true,
              with_vector: true,
            },
          );
          if (res.data?.status === "ok") {
            resolve(res.data.result.points);
          }
          if (operation.retry(new Error())) return;
          reject(
            new Error(
              `Failed to fetch data from collection "${collectionName}" with error message "${res.data?.status?.error}"`,
            ),
          );
        } catch (error) {
          if (operation.retry(new Error())) return;
          reject(error);
        }
      });
    });
  }

  /**
   * Fetch data by id from your database
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection you want to get your data from
   * @param id The id of the point
   * @returns The fetched data if successful.
   * @throws Error if fetching fails.
   */
  async getDataById({
    client,
    collectionName,
    id,
  }: {
    client: AxiosInstance;
    collectionName: string;
    id: number | string;
  }): Promise<any> {
    try {
      const res = await client.post(`/collections/${collectionName}/points`, {
        ids: [id],
        with_payload: true,
        with_vector: true,
      });
      const point = res.data?.result?.[0];
      if (point) {
        return point;
      }
      return new Error(
        `No point found with id "${id}" in collection "${collectionName}"`,
      );
    } catch (error) {
      console.error("Error fetching data from vector database:", error);
      throw this.qdrantError(error);
    }
  }

  /**
   * Update data by id
   * Qdrant points are updated by upserting a point with the same id when a
   * new vector is given, or by overwriting the payload of the existing point.
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection you want to update
   * @param id The id of the point
   * @param updatedContent The new content: a vector and/or a payload
   * @returns Updated data if Success
   * @throws Error if fetching fails.
   */
  async updateById({
    client,
    collectionName,
    id,
    updatedContent,
  }: {
    client: AxiosInstance;
    collectionName: string;
    id: number | string;
    updatedContent: { vector?: number[]; payload?: ArgsObject };
  }): Promise<any> {
    try {
      let res;
      if (updatedContent.vector) {
        // Upsert the point with the same id to replace its vector (and payload)
        res = await client.put(
          `/collections/${collectionName}/points?wait=true`,
          {
            points: [
              {
                id: id,
                vector: updatedContent.vector,
                payload: updatedContent.payload,
              },
            ],
          },
        );
      } else {
        // Only the payload changes: overwrite the payload of the existing point
        res = await client.post(
          `/collections/${collectionName}/points/payload?wait=true`,
          {
            payload: updatedContent.payload,
            points: [id],
          },
        );
      }
      return res.data;
    } catch (error) {
      console.error("Error updating data in vector database:", error);
      throw this.qdrantError(error);
    }
  }

  /**
   * Delete data by id
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection you want to delete from
   * @param id The id of the point
   * @returns Success
   * @throws Error if deleting fails.
   */
  async deleteById({
    client,
    collectionName,
    id,
  }: {
    client: AxiosInstance;
    collectionName: string;
    id: number | string;
  }): Promise<any> {
    try {
      const res = await client.post(
        `/collections/${collectionName}/points/delete?wait=true`,
        {
          points: [id],
        },
      );

      return { status: res.status, messages: res.statusText };
    } catch (error) {
      console.error("Error deleting data from vector database:", error);
      throw this.qdrantError(error);
    }
  }
}

export enum QdrantDistanceMetric {
  COSINE = "Cosine",
  EUCLID = "Euclid",
  DOT = "Dot",
}

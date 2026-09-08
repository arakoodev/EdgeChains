import axios, { AxiosInstance } from "axios";

interface VectorParams {
  size: number;
  distance: string;
  [key: string]: any;
}

interface Point {
  id: string | number;
  vector: number[] | { [name: string]: number[] };
  payload?: { [key: string]: any };
  [key: string]: any;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY: string;

  constructor(QDRANT_URL: string, QDRANT_API_KEY: string) {
    this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(
      /\/$/,
      "",
    );
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
  }

  // Function to create a Qdrant REST API client
  createClient(): AxiosInstance {
    return axios.create({
      baseURL: this.QDRANT_URL,
      headers: {
        "Content-Type": "application/json",
        ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
      },
    });
  }

  /**
   * Create a collection in Qdrant.
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection to create.
   * @param vectors The vector configuration, for example { size: 1536, distance: "Cosine" }.
   * @returns The Qdrant API response.
   */
  async createCollection({
    client,
    collectionName,
    vectors,
  }: {
    client: AxiosInstance;
    collectionName: string;
    vectors: VectorParams;
  }): Promise<any> {
    const res = await client.put(`/collections/${collectionName}`, { vectors });
    return res.data;
  }

  /**
   * Upsert points into a Qdrant collection.
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection.
   * @param points The points to upsert, each with id, vector and optional payload.
   * @returns The Qdrant API response.
   */
  async upsertPoints({
    client,
    collectionName,
    points,
  }: {
    client: AxiosInstance;
    collectionName: string;
    points: Point[];
  }): Promise<any> {
    const res = await client.put(`/collections/${collectionName}/points`, {
      points,
    });
    return res.data;
  }

  /**
   * Search a Qdrant collection with a query vector.
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection.
   * @param vector The query vector.
   * @param limit The maximum number of results to return.
   * @param withPayload Whether to include point payloads in the results.
   * @returns The list of matched points.
   */
  async search({
    client,
    collectionName,
    vector,
    limit,
    withPayload = true,
  }: {
    client: AxiosInstance;
    collectionName: string;
    vector: number[];
    limit: number;
    withPayload?: boolean;
  }): Promise<any> {
    const res = await client.post(
      `/collections/${collectionName}/points/search`,
      {
        vector,
        limit,
        with_payload: withPayload,
      },
    );
    return res.data.result;
  }

  /**
   * Delete points from a Qdrant collection by id.
   * @param client The Qdrant client instance.
   * @param collectionName The name of the collection.
   * @param ids The point ids to delete.
   * @returns The Qdrant API response.
   */
  async deleteByIds({
    client,
    collectionName,
    ids,
  }: {
    client: AxiosInstance;
    collectionName: string;
    ids: (string | number)[];
  }): Promise<any> {
    const res = await client.post(
      `/collections/${collectionName}/points/delete`,
      { points: ids },
    );
    return res.data;
  }
}

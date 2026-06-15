import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

type QdrantPointId = number | string;
type QdrantVector = number[] | Record<string, number[]>;
type QdrantPayload = Record<string, any>;
type QdrantFilter = Record<string, any>;
type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

interface ArgsObject {
  [key: string]: any;
}

interface QdrantClientArgs {
  client: AxiosInstance;
  collectionName: string;
}

interface CreateCollectionArgs extends QdrantClientArgs {
  vectorSize?: number;
  distance?: QdrantDistance;
  vectors?: ArgsObject;
  [key: string]: any;
}

interface InsertVectorDataArgs extends QdrantClientArgs {
  points?: Array<{
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: QdrantPayload;
  }>;
  id?: QdrantPointId;
  vector?: QdrantVector;
  payload?: QdrantPayload;
  wait?: boolean;
}

interface GetDataFromQueryArgs extends QdrantClientArgs {
  vector: QdrantVector;
  limit?: number;
  filter?: QdrantFilter;
  with_payload?: boolean | ArgsObject;
  with_vector?: boolean | string[];
  score_threshold?: number;
  [key: string]: any;
}

interface GetDataArgs extends QdrantClientArgs {
  limit?: number;
  offset?: QdrantPointId;
  filter?: QdrantFilter;
  with_payload?: boolean | ArgsObject;
  with_vector?: boolean | string[];
  [key: string]: any;
}

interface GetDataByIdArgs extends QdrantClientArgs {
  id: QdrantPointId;
  with_payload?: boolean | ArgsObject;
  with_vector?: boolean | string[];
}

interface UpdateByIdArgs extends QdrantClientArgs {
  id: QdrantPointId;
  updatedContent: QdrantPayload;
  wait?: boolean;
}

interface DeleteByIdArgs extends QdrantClientArgs {
  id: QdrantPointId;
  wait?: boolean;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
    this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
  }

  createClient(): AxiosInstance {
    return axios.create({
      baseURL: this.QDRANT_URL,
      headers: this.QDRANT_API_KEY
        ? { "api-key": this.QDRANT_API_KEY }
        : undefined,
    });
  }

  private runWithRetry<T>(
    request: () => Promise<T>,
    errorMessage: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: 5,
        factor: 3,
        minTimeout: 1 * 1000,
        maxTimeout: 60 * 1000,
        randomize: true,
      });

      operation.attempt(async () => {
        try {
          resolve(await request());
        } catch (error: any) {
          if (operation.retry(error)) return;
          reject(new Error(`${errorMessage}: ${error.message || error}`));
        }
      });
    });
  }

  async createCollection({
    client,
    collectionName,
    vectorSize,
    distance = "Cosine",
    vectors,
    ...args
  }: CreateCollectionArgs): Promise<any> {
    if (!vectors && !vectorSize) {
      throw new Error("vectorSize is required when vectors is not provided");
    }

    const body = {
      vectors: vectors || { size: vectorSize, distance },
      ...args,
    };

    return this.runWithRetry(async () => {
      const res = await client.put(`/collections/${collectionName}`, body);
      return res.data;
    }, `Failed to create Qdrant collection "${collectionName}"`);
  }

  async insertVectorData({
    client,
    collectionName,
    points,
    id,
    vector,
    payload,
    wait = true,
  }: InsertVectorDataArgs): Promise<any> {
    const requestPoints =
      points ||
      (id !== undefined && vector ? [{ id, vector, payload }] : undefined);
    if (!requestPoints) {
      throw new Error("points or both id and vector are required");
    }

    return this.runWithRetry(async () => {
      const res = await client.put(
        `/collections/${collectionName}/points`,
        { points: requestPoints },
        { params: { wait } },
      );
      return res.data;
    }, `Failed to upsert points into Qdrant collection "${collectionName}"`);
  }

  async getDataFromQuery({
    client,
    collectionName,
    vector,
    limit = 10,
    filter,
    with_payload = true,
    with_vector = false,
    score_threshold,
    ...args
  }: GetDataFromQueryArgs): Promise<any> {
    return this.runWithRetry(async () => {
      const res = await client.post(
        `/collections/${collectionName}/points/search`,
        {
          vector,
          limit,
          filter,
          with_payload,
          with_vector,
          score_threshold,
          ...args,
        },
      );
      return res.data;
    }, `Failed to search Qdrant collection "${collectionName}"`);
  }

  async getData({
    client,
    collectionName,
    limit = 10,
    offset,
    filter,
    with_payload = true,
    with_vector = false,
    ...args
  }: GetDataArgs): Promise<any> {
    return this.runWithRetry(async () => {
      const res = await client.post(
        `/collections/${collectionName}/points/scroll`,
        {
          limit,
          offset,
          filter,
          with_payload,
          with_vector,
          ...args,
        },
      );
      return res.data;
    }, `Failed to scroll Qdrant collection "${collectionName}"`);
  }

  async getDataById({
    client,
    collectionName,
    id,
    with_payload = true,
    with_vector = false,
  }: GetDataByIdArgs): Promise<any> {
    return this.runWithRetry(async () => {
      const res = await client.get(
        `/collections/${collectionName}/points/${id}`,
        {
          params: { with_payload, with_vector },
        },
      );
      return res.data;
    }, `Failed to fetch Qdrant point "${id}"`);
  }

  async updateById({
    client,
    collectionName,
    id,
    updatedContent,
    wait = true,
  }: UpdateByIdArgs): Promise<any> {
    return this.runWithRetry(async () => {
      const res = await client.put(
        `/collections/${collectionName}/points/payload`,
        { points: [id], payload: updatedContent },
        { params: { wait } },
      );
      return res.data;
    }, `Failed to update Qdrant point "${id}"`);
  }

  async deleteById({
    client,
    collectionName,
    id,
    wait = true,
  }: DeleteByIdArgs): Promise<any> {
    return this.runWithRetry(async () => {
      const res = await client.post(
        `/collections/${collectionName}/points/delete`,
        { points: [id] },
        { params: { wait } },
      );
      return res.data;
    }, `Failed to delete Qdrant point "${id}"`);
  }
}

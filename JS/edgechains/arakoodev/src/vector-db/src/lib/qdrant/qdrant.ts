import retry from "retry";
import { config } from "dotenv";
import { v4 as uuidv4 } from "uuid";
config();

interface QdrantConfig {
  qdrantApiUrl: string;
  qdrantApiKey?: string;
  collectionName?: string;
}

interface InsertVectorArgs {
  collectionName: string;
  points?: {
    id: number | string;
    vector: number[];
    payload?: Record<string, any>;
  }[];
  batch?: {
    ids: (number | string)[];
    vectors: number[][];
    payloads?: Record<string, any>[];
  };
}

interface SearchVectorArgs {
  collectionName: string;
  queryVector: number[];
  top: number;
  filter?: Record<string, any>;
}

interface CreateCollectionArgs {
  collectionName: string;
  vectorSize?: number;
  distance?: "Cosine" | "Euclid" | "Dot";
}

interface UpdateVectorArgs {
  collectionName: string;
  points: {
    id: number | string;
    vector: number[];
    payload?: Record<string, any>;
  }[];
}

interface DeleteVectorArgs {
  collectionName: string;
  vectors: string[];
}

interface DeletePointsArgs {
  collectionName: string;
  filter: Record<string, any>;
  points: number[] | string[];
}

export class QdrantService {
  private qdrantApiUrl: string;
  private qdrantApiKey?: string;
  collectionName: string;

  constructor({ qdrantApiUrl, qdrantApiKey }: QdrantConfig) {
    this.qdrantApiUrl = qdrantApiUrl || process.env.QDRANT_API_URL!;
    this.qdrantApiKey = qdrantApiKey || process.env.QDRANT_API_KEY!;
    this.collectionName = '';
  }


  generateCollectionName(prefix = "collection"): string {
    const uuid = uuidv4(); // Generate a UUID
    const timestamp = Date.now(); // Get the current timestamp
    return `${prefix}_${uuid}_${timestamp}`;
  }

  async assignCollection() {
    this.collectionName = this.generateCollectionName();
    return await this.createCollection({ collectionName: this.collectionName });
  }

  private async request(
    endpoint: string,
    method: string,
    body?: any,
  ): Promise<any> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.qdrantApiKey) {
      headers["Authorization"] = `Bearer ${this.qdrantApiKey}`;
    }

    const response = await fetch(`${this.qdrantApiUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Request failed: ${response.status} - ${error?.message || response.statusText}`,
      );
    }

    return response.json();
  }

  async createCollection({
    collectionName,
    vectorSize,
    distance = "Cosine",
  }: CreateCollectionArgs): Promise<void> {
    const endpoint = `/collections/${collectionName}`;
    const body = {
      vectors: {
        size: vectorSize,
        distance,
      },
    };

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
          const res = await this.request(endpoint, "PUT", body);
          if (res.status?.error) {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to create collection with collection name ${JSON.stringify(collectionName)}, vector size ${vectorSize} with error message "${res.status.error}"`,
              ),
            );
          } else {
            resolve(res);
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }

  async listColletion(): Promise<any> {
    const endpoint = `/collections`;
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
          const res = await this.request(endpoint, "GET");
          if (res.status?.error) {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to retrieve collections with error message "${res.status.error}"`,
              ),
            );
          } else {
            resolve(res);
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }

  async collectionInformation(collectionName: string) {
    const endpoint = `/collections/${collectionName}`;
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
          const res = await this.request(endpoint, "GET");
          if (res.status?.error) {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to retrieve collection of collection name ${collectionName} with error message "${res.status.error}"`,
              ),
            );
          } else {
            resolve(res);
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }

  async deleteCollection(collectionName: string) {
    const endpoint = `/collections/${collectionName}`;
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
          const res = await this.request(endpoint, "DELETE");
          if (res.status?.error) {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to delete collection of collection name ${collectionName} with error message "${res.status.error}"`,
              ),
            );
          } else {
            resolve(res);
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }

  async getPointInformation(collectionName: string, id: string) {
    const endpoint = `/collections/${collectionName}/points/${id}`;
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
          const res = await this.request(endpoint, "GET");
          if (res.status?.error) {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to retrieve point information of collection name ${collectionName} with error message "${res.status.error}"`,
              ),
            );
          } else {
            resolve(res);
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }

  async upsertPoints({
    collectionName,
    points,
    batch,
  }: InsertVectorArgs): Promise<void> {
    const endpoint = `/collections/${collectionName}/points`;
    if (!points && !batch)
      throw new Error("Please provide points or batch to insert vectors");

    const body = points ? { points } : { batch };
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
          const res = await this.request(endpoint, "PUT", body);
          if (res.status?.error) {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to upsert points with data ${JSON.stringify(body)} with error message "${res.status.error}"`,
              ),
            );
          } else {
            resolve(res);
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }

  async deletePoints({ collectionName, points, filter }: DeletePointsArgs) {
    const endpoint = `/collections/${collectionName}/points/delete`;
    if (!points && !filter)
      throw new Error("Please provide points or batch to insert vectors");

    const body = points ? { points } : { filter };
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
          const res = await this.request(endpoint, "POST", body);
          if (res.status?.error) {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to delete points with data ${JSON.stringify(body)} with error message "${res.status.error}"`,
              ),
            );
          } else {
            resolve(res);
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }

  

  async updateVectors({ collectionName, points }: UpdateVectorArgs) {
    const endpoint = `/collections/${collectionName}/points/vectors`;

    const body = { points };
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
          const res = await this.request(endpoint, "PUT", body);
          if (res.status?.error) {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to update vectors with data ${JSON.stringify(body)} with error message "${res.status.error}"`,
              ),
            );
          } else {
            resolve(res);
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }

  async deleteVectors({ collectionName, vectors }: DeleteVectorArgs) {
    const endpoint = `/collections/${collectionName}/points/vectors/delete`;

    const body = { vectors };
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
          const res = await this.request(endpoint, "PUT", body);
          if (res.status?.error) {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to delete vectors with data ${JSON.stringify(body)} with error message "${res.status.error}"`,
              ),
            );
          } else {
            resolve(res);
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }

  async searchVectors({
    collectionName,
    queryVector,
    top,
    filter,
  }: SearchVectorArgs): Promise<any> {
    const endpoint = `/collections/${collectionName}/points/search`;
    const body = {
      vector: queryVector,
      limit: top,
      filter,
    };

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
          const res = await this.request(endpoint, "POST", body);
          if (res.status?.error) {
            if (operation.retry(new Error())) {
              return;
            }
            reject(
              new Error(
                `Failed to retrieve vectors with data ${JSON.stringify(body)} with error message "${res.status.error}"`,
              ),
            );
          } else {
            resolve(res);
          }
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }
}

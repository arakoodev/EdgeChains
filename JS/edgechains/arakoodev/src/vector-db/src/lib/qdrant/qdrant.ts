import axios, { AxiosInstance } from "axios";

type QdrantPointId = string | number;

export interface QdrantPoint {
    id: QdrantPointId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

export interface QdrantSearchResult {
    id: QdrantPointId;
    score: number;
    payload?: Record<string, any>;
    vector?: number[] | Record<string, number[]>;
}

export interface QdrantCollectionConfig {
    vectors:
        | {
              size: number;
              distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
          }
        | Record<
              string,
              {
                  size: number;
                  distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
              }
          >;
    shard_number?: number;
    replication_factor?: number;
    write_consistency_factor?: number;
    on_disk_payload?: boolean;
}

export interface QdrantSearchOptions {
    vector: number[] | Record<string, number[]>;
    limit?: number;
    filter?: Record<string, any>;
    with_payload?: boolean | string[] | Record<string, any>;
    with_vector?: boolean | string[];
    score_threshold?: number;
}

export class Qdrant {
    client: AxiosInstance;

    constructor({
        url,
        apiKey,
    }: {
        url?: string;
        apiKey?: string;
    }) {
        const baseURL = (url || process.env.QDRANT_URL || "").replace(/\/$/, "");
        const key = apiKey || process.env.QDRANT_API_KEY || "";

        this.client = axios.create({
            baseURL,
            headers: {
                "Content-Type": "application/json",
                ...(key ? { "api-key": key } : {}),
            },
        });
    }

    async createCollection({
        collectionName,
        config,
    }: {
        collectionName: string;
        config: QdrantCollectionConfig;
    }): Promise<any> {
        const response = await this.client.put(`/collections/${collectionName}`, config);
        return response.data;
    }

    async getCollection({ collectionName }: { collectionName: string }): Promise<any> {
        const response = await this.client.get(`/collections/${collectionName}`);
        return response.data;
    }

    async deleteCollection({ collectionName }: { collectionName: string }): Promise<any> {
        const response = await this.client.delete(`/collections/${collectionName}`);
        return response.data;
    }

    async upsertPoints({
        collectionName,
        points,
        wait = true,
    }: {
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        const response = await this.client.put(
            `/collections/${collectionName}/points`,
            { points },
            { params: { wait } }
        );
        return response.data;
    }

    async searchPoints({
        collectionName,
        ...searchOptions
    }: {
        collectionName: string;
    } & QdrantSearchOptions): Promise<QdrantSearchResult[]> {
        const response = await this.client.post(
            `/collections/${collectionName}/points/search`,
            searchOptions
        );
        return response.data.result;
    }

    async retrievePoints({
        collectionName,
        ids,
        with_payload = true,
        with_vector = false,
    }: {
        collectionName: string;
        ids: QdrantPointId[];
        with_payload?: boolean | string[] | Record<string, any>;
        with_vector?: boolean | string[];
    }): Promise<any[]> {
        const response = await this.client.post(`/collections/${collectionName}/points`, {
            ids,
            with_payload,
            with_vector,
        });
        return response.data.result;
    }

    async deletePoints({
        collectionName,
        ids,
        wait = true,
    }: {
        collectionName: string;
        ids: QdrantPointId[];
        wait?: boolean;
    }): Promise<any> {
        const response = await this.client.post(
            `/collections/${collectionName}/points/delete`,
            { points: ids },
            { params: { wait } }
        );
        return response.data;
    }

    async scrollPoints({
        collectionName,
        limit = 10,
        offset,
        filter,
        with_payload = true,
        with_vector = false,
    }: {
        collectionName: string;
        limit?: number;
        offset?: QdrantPointId;
        filter?: Record<string, any>;
        with_payload?: boolean | string[] | Record<string, any>;
        with_vector?: boolean | string[];
    }): Promise<any> {
        const response = await this.client.post(`/collections/${collectionName}/points/scroll`, {
            limit,
            offset,
            filter,
            with_payload,
            with_vector,
        });
        return response.data.result;
    }
}

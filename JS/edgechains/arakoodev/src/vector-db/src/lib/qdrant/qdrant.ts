import axios, { type AxiosInstance } from "axios";
import { config } from "dotenv";

config();

export type QdrantDistance = "Cosine" | "Dot" | "Euclid" | "Manhattan";
export type QdrantPointId = number | string;
export type QdrantPayload = Record<string, unknown>;

export interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
    timeout?: number;
}

export interface QdrantCollectionOptions {
    client: AxiosInstance;
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistance;
}

export interface QdrantPoint {
    id: QdrantPointId;
    vector: number[];
    payload?: QdrantPayload;
}

export interface QdrantInsertVectorDataArgs {
    client: AxiosInstance;
    collectionName: string;
    points?: QdrantPoint[];
    id?: QdrantPointId;
    vector?: number[];
    payload?: QdrantPayload;
    wait?: boolean;
}

export interface QdrantSearchOptions {
    client: AxiosInstance;
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: QdrantPayload;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
}

export interface QdrantPointLookupOptions {
    client: AxiosInstance;
    collectionName: string;
    id: QdrantPointId;
}

export interface QdrantDeleteOptions extends QdrantPointLookupOptions {
    wait?: boolean;
}

export class Qdrant {
    readonly url: string;
    readonly apiKey: string;
    readonly timeout: number;

    constructor(options: QdrantClientOptions = {}) {
        this.url = options.url || process.env.QDRANT_URL || "http://localhost:6333";
        this.apiKey = options.apiKey || process.env.QDRANT_API_KEY || "";
        this.timeout = options.timeout || 30000;
    }

    createClient(): AxiosInstance {
        return axios.create({
            baseURL: this.url.replace(/\/$/, ""),
            timeout: this.timeout,
            headers: {
                "Content-Type": "application/json",
                ...(this.apiKey ? { "api-key": this.apiKey } : {}),
            },
        });
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: QdrantCollectionOptions): Promise<unknown> {
        const response = await client.put(`/collections/${collectionName}`, {
            vectors: {
                size: vectorSize,
                distance,
            },
        });

        return response.data;
    }

    async insertVectorData({
        client,
        collectionName,
        points,
        id,
        vector,
        payload,
        wait,
    }: QdrantInsertVectorDataArgs): Promise<unknown> {
        const normalizedPoints = points ?? this.createSinglePoint({ id, vector, payload });
        const response = await client.put(`/collections/${collectionName}/points`, {
            points: normalizedPoints,
            ...(wait === undefined ? {} : { wait }),
        });

        return response.data;
    }

    async search({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: QdrantSearchOptions): Promise<unknown> {
        const response = await client.post(`/collections/${collectionName}/points/search`, {
            vector,
            limit,
            ...(filter === undefined ? {} : { filter }),
            with_payload: withPayload,
            with_vector: withVector,
        });

        return response.data;
    }

    async getDataById({
        client,
        collectionName,
        id,
    }: QdrantPointLookupOptions): Promise<unknown> {
        const response = await client.get(`/collections/${collectionName}/points/${id}`);

        return response.data;
    }

    async deleteById({
        client,
        collectionName,
        id,
        wait,
    }: QdrantDeleteOptions): Promise<unknown> {
        const response = await client.post(`/collections/${collectionName}/points/delete`, {
            points: [id],
            ...(wait === undefined ? {} : { wait }),
        });

        return response.data;
    }

    private createSinglePoint({
        id,
        vector,
        payload,
    }: {
        id?: QdrantPointId;
        vector?: number[];
        payload?: QdrantPayload;
    }): QdrantPoint[] {
        if (id === undefined) {
            throw new Error("Qdrant point id is required when points are not provided.");
        }

        if (!vector || vector.length === 0) {
            throw new Error("Qdrant point vector is required when points are not provided.");
        }

        return [
            {
                id,
                vector,
                ...(payload === undefined ? {} : { payload }),
            },
        ];
    }
}

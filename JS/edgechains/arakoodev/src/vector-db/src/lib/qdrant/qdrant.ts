import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

type QdrantPointId = number | string;
type QdrantVector = number[] | Record<string, number[]>;
type QdrantPayload = Record<string, any>;

interface QdrantPoint {
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: QdrantPayload;
}

interface QdrantRequestOptions {
    wait?: boolean;
    ordering?: "weak" | "medium" | "strong";
}

interface CreateCollectionArgs {
    client: AxiosInstance;
    collectionName: string;
    vectorSize?: number;
    distance?: QdrantDistanceMetric;
    vectorsConfig?: Record<string, any>;
    [key: string]: any;
}

interface UpsertPointsArgs extends QdrantRequestOptions {
    client: AxiosInstance;
    collectionName: string;
    points: QdrantPoint[];
}

interface InsertVectorDataArgs extends QdrantRequestOptions {
    client: AxiosInstance;
    collectionName: string;
    points?: QdrantPoint[];
    id?: QdrantPointId;
    vector?: QdrantVector;
    payload?: QdrantPayload;
}

interface SearchPointsArgs {
    client: AxiosInstance;
    collectionName: string;
    vector: QdrantVector;
    limit?: number;
    offset?: QdrantPointId;
    filter?: Record<string, any>;
    params?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[] | Record<string, any>;
    scoreThreshold?: number;
}

interface ScrollPointsArgs {
    client: AxiosInstance;
    collectionName: string;
    limit?: number;
    offset?: QdrantPointId;
    filter?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[] | Record<string, any>;
}

interface GetPointByIdArgs {
    client: AxiosInstance;
    collectionName: string;
    id: QdrantPointId;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
}

interface DeletePointsArgs extends QdrantRequestOptions {
    client: AxiosInstance;
    collectionName: string;
    points?: QdrantPointId[];
    filter?: Record<string, any>;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333";
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient() {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        return axios.create({
            baseURL: this.QDRANT_URL.replace(/\/+$/, ""),
            headers,
        });
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = QdrantDistanceMetric.COSINE,
        vectorsConfig,
        ...args
    }: CreateCollectionArgs): Promise<any> {
        if (!vectorsConfig && !vectorSize) {
            throw new Error("Either vectorSize or vectorsConfig is required to create a collection");
        }

        const body = {
            vectors: vectorsConfig || {
                size: vectorSize,
                distance,
            },
            ...args,
        };

        return this.requestWithRetry(async () => {
            const response = await client.put(this.collectionPath(collectionName), body);
            return response.data;
        });
    }

    async upsertPoints({
        client,
        collectionName,
        points,
        wait,
        ordering,
    }: UpsertPointsArgs): Promise<any> {
        return this.requestWithRetry(async () => {
            const response = await client.put(
                `${this.collectionPath(collectionName)}/points`,
                { points },
                { params: this.requestParams({ wait, ordering }) }
            );
            return response.data;
        });
    }

    async insertVectorData({
        points,
        id,
        vector,
        payload,
        ...args
    }: InsertVectorDataArgs): Promise<any> {
        const qdrantPoints = points || (id !== undefined && vector ? [{ id, vector, payload }] : undefined);

        if (!qdrantPoints) {
            throw new Error("Either points or both id and vector are required to insert Qdrant data");
        }

        return this.upsertPoints({
            ...args,
            points: qdrantPoints,
        });
    }

    async searchPoints({
        client,
        collectionName,
        vector,
        limit = 10,
        offset,
        filter,
        params,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: SearchPointsArgs): Promise<any> {
        const body = this.cleanBody({
            vector,
            limit,
            offset,
            filter,
            params,
            with_payload: withPayload,
            with_vector: withVector,
            score_threshold: scoreThreshold,
        });

        return this.requestWithRetry(async () => {
            const response = await client.post(`${this.collectionPath(collectionName)}/points/search`, body);
            return response.data;
        });
    }

    async getData({
        client,
        collectionName,
        limit = 10,
        offset,
        filter,
        withPayload = true,
        withVector = false,
    }: ScrollPointsArgs): Promise<any> {
        const body = this.cleanBody({
            limit,
            offset,
            filter,
            with_payload: withPayload,
            with_vector: withVector,
        });

        return this.requestWithRetry(async () => {
            const response = await client.post(`${this.collectionPath(collectionName)}/points/scroll`, body);
            return response.data;
        });
    }

    async getDataById({
        client,
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: GetPointByIdArgs): Promise<any> {
        return this.requestWithRetry(async () => {
            const response = await client.get(
                `${this.collectionPath(collectionName)}/points/${encodeURIComponent(id)}`,
                {
                    params: {
                        with_payload: withPayload,
                        with_vector: withVector,
                    },
                }
            );
            return response.data;
        });
    }

    async deleteById({
        client,
        collectionName,
        id,
        wait,
        ordering,
    }: {
        client: AxiosInstance;
        collectionName: string;
        id: QdrantPointId;
    } & QdrantRequestOptions): Promise<any> {
        return this.deletePoints({
            client,
            collectionName,
            points: [id],
            wait,
            ordering,
        });
    }

    async deletePoints({
        client,
        collectionName,
        points,
        filter,
        wait,
        ordering,
    }: DeletePointsArgs): Promise<any> {
        if (!points && !filter) {
            throw new Error("Either points or filter is required to delete Qdrant points");
        }

        return this.requestWithRetry(async () => {
            const response = await client.post(
                `${this.collectionPath(collectionName)}/points/delete`,
                points ? { points } : { filter },
                { params: this.requestParams({ wait, ordering }) }
            );
            return response.data;
        });
    }

    private collectionPath(collectionName: string) {
        return `/collections/${encodeURIComponent(collectionName)}`;
    }

    private requestParams(options: QdrantRequestOptions) {
        return this.cleanBody(options);
    }

    private cleanBody<T extends Record<string, any>>(body: T) {
        return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
    }

    private async requestWithRetry<T>(request: () => Promise<T>): Promise<T> {
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
                    const retryError = this.toError(error);
                    if (operation.retry(retryError)) return;
                    reject(operation.mainError() || retryError);
                }
            });
        });
    }

    private toError(error: any) {
        if (error instanceof Error) return error;

        const message = typeof error === "string" ? error : JSON.stringify(error);
        return new Error(message);
    }
}

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    DOT = "Dot",
    EUCLID = "Euclid",
    MANHATTAN = "Manhattan",
}

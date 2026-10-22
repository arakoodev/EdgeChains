import axios from "axios";
import type { AxiosInstance, AxiosResponse } from "axios";
import { randomUUID } from "crypto";
import retry from "retry";
import { config } from "dotenv";
config();

export type QdrantPointId = number | string;
export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";
export type QdrantPayload = Record<string, any>;
export type QdrantVector = number[] | number[][] | Record<string, any>;

export interface QdrantPoint {
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: QdrantPayload;
}

interface CreateCollectionArgs {
    client: AxiosInstance;
    collectionName: string;
    size?: number;
    distance?: QdrantDistance;
    vectors?: Record<string, any>;
    [key: string]: any;
}

interface InsertVectorDataArgs {
    client: AxiosInstance;
    collectionName: string;
    id?: QdrantPointId;
    vector?: QdrantVector;
    embedding?: number[];
    payload?: QdrantPayload;
    wait?: boolean;
    [key: string]: any;
}

interface UpsertPointsArgs {
    client: AxiosInstance;
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
    updateFilter?: Record<string, any>;
}

interface QueryPointsArgs {
    client: AxiosInstance;
    collectionName: string;
    query?: QdrantVector | QdrantPointId | Record<string, any>;
    vector?: QdrantVector;
    filter?: Record<string, any>;
    limit?: number;
    withPayload?: boolean | string[] | Record<string, any>;
    withVectors?: boolean | string[];
    [key: string]: any;
}

interface ScrollPointsArgs {
    client: AxiosInstance;
    collectionName: string;
    filter?: Record<string, any>;
    limit?: number;
    offset?: QdrantPointId | Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
    [key: string]: any;
}

interface GetDataByIdArgs {
    client: AxiosInstance;
    collectionName: string;
    id: QdrantPointId;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
}

interface SetPayloadArgs {
    client: AxiosInstance;
    collectionName: string;
    payload: QdrantPayload;
    points?: QdrantPointId[];
    filter?: Record<string, any>;
    key?: string;
    wait?: boolean;
}

interface UpdateByIdArgs {
    client: AxiosInstance;
    collectionName: string;
    id: QdrantPointId;
    updatedContent: QdrantPayload;
    key?: string;
    wait?: boolean;
}

interface DeleteByIdArgs {
    client: AxiosInstance;
    collectionName: string;
    id: QdrantPointId;
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
    }

    createClient(): AxiosInstance {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        return axios.create({
            baseURL: this.QDRANT_URL,
            headers,
        });
    }

    async createCollection({
        client,
        collectionName,
        size,
        distance = "Cosine",
        vectors,
        ...options
    }: CreateCollectionArgs): Promise<any> {
        if (!vectors && typeof size !== "number") {
            throw new Error("Qdrant collection creation requires either size or vectors.");
        }

        const body = {
            ...options,
            vectors: vectors || {
                size,
                distance,
            },
        };

        return this.withRetry(
            () => client.put(`/collections/${collectionName}`, body),
            `Failed to create Qdrant collection "${collectionName}"`
        );
    }

    async insertVectorData({
        client,
        collectionName,
        id,
        vector,
        embedding,
        payload,
        wait,
        ...payloadArgs
    }: InsertVectorDataArgs): Promise<any> {
        const pointVector = vector || embedding;

        if (!pointVector) {
            throw new Error("Qdrant insertVectorData requires vector or embedding.");
        }

        const point: QdrantPoint = {
            id: id ?? randomUUID(),
            vector: pointVector,
            payload: payload || payloadArgs,
        };

        return this.upsertPoints({ client, collectionName, points: [point], wait });
    }

    async upsertPoints({
        client,
        collectionName,
        points,
        wait,
        updateFilter,
    }: UpsertPointsArgs): Promise<any> {
        return this.withRetry(
            () =>
                client.put(
                    `/collections/${collectionName}/points`,
                    {
                        points,
                        ...(updateFilter ? { update_filter: updateFilter } : {}),
                    },
                    this.withWait(wait)
                ),
            `Failed to upsert points into Qdrant collection "${collectionName}"`
        );
    }

    async getDataFromQuery({
        client,
        collectionName,
        query,
        vector,
        filter,
        limit = 10,
        withPayload = true,
        withVectors = false,
        ...queryOptions
    }: QueryPointsArgs): Promise<any> {
        const queryValue = query ?? vector;

        if (!queryValue) {
            throw new Error("Qdrant getDataFromQuery requires query or vector.");
        }

        return this.withRetry(
            () =>
                client.post(`/collections/${collectionName}/points/query`, {
                    ...queryOptions,
                    query: queryValue,
                    ...(filter ? { filter } : {}),
                    limit,
                    with_payload: withPayload,
                    with_vectors: withVectors,
                }),
            `Failed to query Qdrant collection "${collectionName}"`
        );
    }

    async getData({
        client,
        collectionName,
        filter,
        limit = 10,
        offset,
        withPayload = true,
        withVector = false,
        ...scrollOptions
    }: ScrollPointsArgs): Promise<any> {
        return this.withRetry(
            () =>
                client.post(`/collections/${collectionName}/points/scroll`, {
                    ...scrollOptions,
                    ...(filter ? { filter } : {}),
                    ...(offset !== undefined ? { offset } : {}),
                    limit,
                    with_payload: withPayload,
                    with_vector: withVector,
                }),
            `Failed to scroll Qdrant collection "${collectionName}"`
        );
    }

    async getDataById({
        client,
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: GetDataByIdArgs): Promise<any> {
        return this.withRetry(
            () =>
                client.post(`/collections/${collectionName}/points`, {
                    ids: [id],
                    with_payload: withPayload,
                    with_vector: withVector,
                }),
            `Failed to retrieve point "${id}" from Qdrant collection "${collectionName}"`
        );
    }

    async setPayload({
        client,
        collectionName,
        payload,
        points,
        filter,
        key,
        wait,
    }: SetPayloadArgs): Promise<any> {
        return this.withRetry(
            () =>
                client.post(
                    `/collections/${collectionName}/points/payload`,
                    {
                        payload,
                        ...(points ? { points } : {}),
                        ...(filter ? { filter } : {}),
                        ...(key ? { key } : {}),
                    },
                    this.withWait(wait)
                ),
            `Failed to set payload in Qdrant collection "${collectionName}"`
        );
    }

    async updateById({
        client,
        collectionName,
        id,
        updatedContent,
        key,
        wait,
    }: UpdateByIdArgs): Promise<any> {
        return this.setPayload({
            client,
            collectionName,
            payload: updatedContent,
            points: [id],
            key,
            wait,
        });
    }

    async deleteById({ client, collectionName, id, wait }: DeleteByIdArgs): Promise<any> {
        return this.withRetry(
            () =>
                client.post(
                    `/collections/${collectionName}/points/delete`,
                    {
                        points: [id],
                    },
                    this.withWait(wait)
                ),
            `Failed to delete point "${id}" from Qdrant collection "${collectionName}"`
        );
    }

    private withWait(wait?: boolean) {
        return wait === undefined ? undefined : { params: { wait } };
    }

    private async withRetry<T>(
        request: () => Promise<AxiosResponse<T>>,
        failureMessage: string
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
                    const response = await request();
                    resolve(response.data);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(this.toError(error, failureMessage));
                }
            });
        });
    }

    private toError(error: any, failureMessage: string): Error {
        const status = error?.response?.status;
        const data = error?.response?.data;
        const details = data ? `: ${JSON.stringify(data)}` : error?.message ? `: ${error.message}` : "";

        return new Error(`${failureMessage}${status ? ` (status ${status})` : ""}${details}`);
    }
}

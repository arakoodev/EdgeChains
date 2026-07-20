import { config } from "dotenv";
config();

type QdrantPointId = number | string;
type QdrantVector = number[] | Record<string, number[]>;
type QdrantPayload = Record<string, unknown>;
type QdrantOrdering = "weak" | "medium" | "strong";

export interface QdrantClient {
    url: string;
    apiKey?: string;
}

export interface QdrantPoint {
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: QdrantPayload;
}

interface QdrantRequestOptions {
    consistency?: number | string;
    timeout?: number;
    wait?: boolean;
    ordering?: QdrantOrdering;
}

interface InsertVectorDataArgs extends QdrantRequestOptions {
    client: QdrantClient;
    collectionName: string;
    points?: QdrantPoint[];
    id?: QdrantPointId;
    vector?: QdrantVector;
    payload?: QdrantPayload;
}

interface GetDataFromQueryArgs extends QdrantRequestOptions {
    client: QdrantClient;
    collectionName: string;
    query?: unknown;
    prefetch?: unknown;
    using?: string;
    filter?: unknown;
    params?: unknown;
    scoreThreshold?: number;
    limit?: number;
    offset?: number;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
    lookupFrom?: unknown;
    shardKey?: unknown;
}

interface GetDataByIdArgs extends QdrantRequestOptions {
    client: QdrantClient;
    collectionName: string;
    ids?: QdrantPointId[];
    id?: QdrantPointId;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
    shardKey?: unknown;
}

interface DeleteByIdArgs extends QdrantRequestOptions {
    client: QdrantClient;
    collectionName: string;
    ids?: QdrantPointId[];
    id?: QdrantPointId;
    filter?: unknown;
    shardKey?: unknown;
}

interface CreateCollectionArgs extends QdrantRequestOptions {
    client: QdrantClient;
    collectionName: string;
    vectors: unknown;
    shardNumber?: number;
    replicationFactor?: number;
    writeConsistencyFactor?: number;
    onDiskPayload?: boolean;
}

interface UpdateByIdArgs extends QdrantRequestOptions {
    client: QdrantClient;
    collectionName: string;
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: QdrantPayload;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient(): QdrantClient {
        return {
            url: this.QDRANT_URL.replace(/\/+$/, ""),
            apiKey: this.QDRANT_API_KEY,
        };
    }

    async createCollection({
        client,
        collectionName,
        vectors,
        shardNumber,
        replicationFactor,
        writeConsistencyFactor,
        onDiskPayload,
        ...queryOptions
    }: CreateCollectionArgs): Promise<any> {
        return this.request({
            client,
            method: "PUT",
            path: `/collections/${encodeURIComponent(collectionName)}`,
            query: this.queryFromOptions(queryOptions),
            body: this.cleanObject({
                vectors,
                shard_number: shardNumber,
                replication_factor: replicationFactor,
                write_consistency_factor: writeConsistencyFactor,
                on_disk_payload: onDiskPayload,
            }),
        });
    }

    async insertVectorData({
        client,
        collectionName,
        points,
        id,
        vector,
        payload,
        ...queryOptions
    }: InsertVectorDataArgs): Promise<any> {
        const pointsToUpsert = points || [{ id, vector, payload }];

        return this.request({
            client,
            method: "PUT",
            path: `/collections/${encodeURIComponent(collectionName)}/points`,
            query: this.queryFromOptions(queryOptions),
            body: {
                points: pointsToUpsert.map((point) => this.cleanObject(point)),
            },
        });
    }

    async getDataFromQuery({
        client,
        collectionName,
        scoreThreshold,
        withPayload,
        withVector,
        lookupFrom,
        shardKey,
        consistency,
        timeout,
        wait,
        ordering,
        ...args
    }: GetDataFromQueryArgs): Promise<any> {
        return this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(collectionName)}/points/query`,
            query: this.queryFromOptions({ consistency, timeout, wait, ordering }),
            body: this.cleanObject({
                ...args,
                score_threshold: scoreThreshold,
                with_payload: withPayload,
                with_vector: withVector,
                lookup_from: lookupFrom,
                shard_key: shardKey,
            }),
        });
    }

    async getDataById({
        client,
        collectionName,
        ids,
        id,
        withPayload,
        withVector,
        shardKey,
        ...queryOptions
    }: GetDataByIdArgs): Promise<any> {
        return this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(collectionName)}/points`,
            query: this.queryFromOptions(queryOptions),
            body: this.cleanObject({
                ids: ids || [id],
                with_payload: withPayload,
                with_vector: withVector,
                shard_key: shardKey,
            }),
        });
    }

    async updateById({ client, collectionName, id, vector, payload, ...queryOptions }: UpdateByIdArgs) {
        return this.insertVectorData({
            client,
            collectionName,
            points: [{ id, vector, payload }],
            ...queryOptions,
        });
    }

    async deleteById({
        client,
        collectionName,
        ids,
        id,
        filter,
        shardKey,
        ...queryOptions
    }: DeleteByIdArgs): Promise<any> {
        return this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(collectionName)}/points/delete`,
            query: this.queryFromOptions(queryOptions),
            body: this.cleanObject({
                points: ids || (id !== undefined ? [id] : undefined),
                filter,
                shard_key: shardKey,
            }),
        });
    }

    private async request({
        client,
        method,
        path,
        query,
        body,
    }: {
        client: QdrantClient;
        method: string;
        path: string;
        query?: URLSearchParams;
        body?: unknown;
    }): Promise<any> {
        const queryString = query?.toString();
        const response = await fetch(`${client.url}${path}${queryString ? `?${queryString}` : ""}`, {
            method,
            headers: this.cleanObject({
                "Content-Type": "application/json",
                "api-key": client.apiKey,
            }) as HeadersInit,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const responseBody = await response.json().catch(() => undefined);

        if (!response.ok || responseBody?.status === "error") {
            throw new Error(
                `Qdrant request failed with status ${response.status}: ${JSON.stringify(responseBody)}`
            );
        }

        return responseBody?.result ?? responseBody;
    }

    private queryFromOptions(options: QdrantRequestOptions): URLSearchParams {
        const query = new URLSearchParams();
        const queryMap: Record<string, unknown> = {
            consistency: options.consistency,
            timeout: options.timeout,
            wait: options.wait,
            ordering: options.ordering,
        };

        Object.entries(queryMap).forEach(([key, value]) => {
            if (value !== undefined) {
                query.set(key, String(value));
            }
        });

        return query;
    }

    private cleanObject<T extends Record<string, unknown>>(value: T): T {
        return Object.fromEntries(
            Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
        ) as T;
    }
}

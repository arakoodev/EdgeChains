import { randomUUID } from "crypto";

export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";
export type QdrantPointId = string | number;
export type QdrantPayload = Record<string, unknown>;
export type QdrantVector = number[];

export interface QdrantClient {
    url: string;
    apiKey?: string;
    fetch: FetchLike;
}

export interface QdrantPoint {
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: QdrantPayload;
}

export interface CreateCollectionArgs {
    client: QdrantClient;
    collectionName?: string;
    tableName?: string;
    vectorSize: number;
    distance?: QdrantDistance;
}

export interface InsertVectorDataArgs {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    id?: QdrantPointId;
    vector?: QdrantVector;
    embedding?: QdrantVector;
    payload?: QdrantPayload;
    wait?: boolean;
    [key: string]: unknown;
}

export interface SearchArgs {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    queryVector?: QdrantVector;
    query_embedding?: QdrantVector;
    vector?: QdrantVector;
    embedding?: QdrantVector;
    limit?: number;
    match_count?: number;
    scoreThreshold?: number;
    similarity_threshold?: number;
    filter?: QdrantPayload;
    withPayload?: boolean;
    withVector?: boolean;
}

export interface ScrollArgs {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    limit?: number;
    offset?: QdrantPointId | Record<string, unknown>;
    filter?: QdrantPayload;
    withPayload?: boolean;
    withVector?: boolean;
}

export interface PointByIdArgs {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    id: QdrantPointId;
}

export interface UpdateByIdArgs extends PointByIdArgs {
    updatedContent: QdrantPayload;
    wait?: boolean;
}

interface FetchLike {
    (
        input: string,
        init: {
            method: string;
            headers: Record<string, string>;
            body?: string;
        }
    ): Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        text(): Promise<string>;
        json(): Promise<unknown>;
    }>;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;
    fetcher: FetchLike;

    constructor(
        QDRANT_URL?: string,
        QDRANT_API_KEY?: string,
        fetcher?: FetchLike
    ) {
        this.QDRANT_URL =
            QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333";
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
        this.fetcher = fetcher || getGlobalFetch();
    }

    createClient(): QdrantClient {
        return {
            url: this.QDRANT_URL.replace(/\/$/, ""),
            apiKey: this.QDRANT_API_KEY,
            fetch: this.fetcher,
        };
    }

    async createCollection({
        client,
        collectionName,
        tableName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<unknown> {
        return this.request(client, "PUT", `/collections/${collection(collectionName, tableName)}`, {
            vectors: {
                size: vectorSize,
                distance,
            },
        });
    }

    async insertVectorData({
        client,
        tableName,
        collectionName,
        id,
        vector,
        embedding,
        payload,
        wait = true,
        ...rest
    }: InsertVectorDataArgs): Promise<unknown> {
        const pointVector = vector || embedding;
        if (!pointVector) {
            throw new Error("Qdrant insertVectorData requires vector or embedding.");
        }

        const pointPayload = payload || restPayload(rest);
        const point: QdrantPoint = {
            id: id || randomUUID(),
            vector: pointVector,
            payload: pointPayload,
        };

        return this.request(
            client,
            "PUT",
            `/collections/${collection(collectionName, tableName)}/points?wait=${wait}`,
            { points: [point] }
        );
    }

    async getDataFromQuery({
        client,
        tableName,
        collectionName,
        queryVector,
        query_embedding,
        vector,
        embedding,
        limit,
        match_count,
        scoreThreshold,
        similarity_threshold,
        filter,
        withPayload = true,
        withVector = false,
    }: SearchArgs): Promise<unknown> {
        const searchVector = queryVector || query_embedding || vector || embedding;
        if (!searchVector) {
            throw new Error(
                "Qdrant getDataFromQuery requires queryVector, query_embedding, vector, or embedding."
            );
        }

        return this.request(
            client,
            "POST",
            `/collections/${collection(collectionName, tableName)}/points/search`,
            {
                vector: searchVector,
                limit: limit || match_count || 10,
                score_threshold: scoreThreshold ?? similarity_threshold,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            }
        );
    }

    async getData({
        client,
        tableName,
        collectionName,
        limit = 10,
        offset,
        filter,
        withPayload = true,
        withVector = false,
    }: ScrollArgs): Promise<unknown> {
        return this.request(
            client,
            "POST",
            `/collections/${collection(collectionName, tableName)}/points/scroll`,
            {
                limit,
                offset,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            }
        );
    }

    async getDataById({
        client,
        tableName,
        collectionName,
        id,
    }: PointByIdArgs): Promise<unknown> {
        const response = (await this.request(
            client,
            "POST",
            `/collections/${collection(collectionName, tableName)}/points`,
            {
                ids: [id],
                with_payload: true,
                with_vector: true,
            }
        )) as { result?: unknown[] };

        return response.result?.[0] || null;
    }

    async updateById({
        client,
        tableName,
        collectionName,
        id,
        updatedContent,
        wait = true,
    }: UpdateByIdArgs): Promise<unknown> {
        return this.request(
            client,
            "POST",
            `/collections/${collection(collectionName, tableName)}/points/payload?wait=${wait}`,
            {
                payload: updatedContent,
                points: [id],
            }
        );
    }

    async deleteById({
        client,
        tableName,
        collectionName,
        id,
    }: PointByIdArgs): Promise<unknown> {
        return this.request(
            client,
            "POST",
            `/collections/${collection(collectionName, tableName)}/points/delete`,
            {
                points: [id],
            }
        );
    }

    private async request(
        client: QdrantClient,
        method: string,
        path: string,
        body?: Record<string, unknown>
    ): Promise<unknown> {
        const response = await client.fetch(`${client.url}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(client.apiKey ? { "api-key": client.apiKey } : {}),
            },
            body: body ? JSON.stringify(stripUndefined(body)) : undefined,
        });

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with ${response.status} ${response.statusText}: ${await response.text()}`
            );
        }

        return response.json();
    }
}

function collection(collectionName?: string, tableName?: string): string {
    const value = collectionName || tableName;
    if (!value) {
        throw new Error("Qdrant collectionName or tableName is required.");
    }

    return encodeURIComponent(value);
}

function restPayload(rest: Record<string, unknown>): QdrantPayload {
    const {
        client,
        tableName,
        collectionName,
        id,
        vector,
        embedding,
        wait,
        ...payload
    } = rest;
    return payload;
}

function stripUndefined(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(stripUndefined);
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, entryValue]) => entryValue !== undefined)
                .map(([entryKey, entryValue]) => [entryKey, stripUndefined(entryValue)])
        );
    }

    return value;
}

function getGlobalFetch(): FetchLike {
    if (!globalThis.fetch) {
        throw new Error("A fetch implementation is required to call Qdrant.");
    }

    return globalThis.fetch as unknown as FetchLike;
}

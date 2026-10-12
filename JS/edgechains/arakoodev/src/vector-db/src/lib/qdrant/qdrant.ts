import { config } from "dotenv";
config();

export type QdrantPointId = number | string;
export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";
export type QdrantVector = number[] | Record<string, number[]>;
export type QdrantWithPayload = boolean | string[] | Record<string, unknown>;
export type QdrantWithVector = boolean | string[];

export interface QdrantClient {
    url: string;
    headers: Record<string, string>;
}

export interface QdrantPoint {
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: Record<string, unknown>;
}

interface CreateCollectionArgs {
    client: QdrantClient;
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistance;
}

interface InsertVectorDataArgs {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    points?: QdrantPoint[];
    id?: QdrantPointId;
    vector?: QdrantVector;
    payload?: Record<string, unknown>;
    wait?: boolean;
    [key: string]: unknown;
}

interface GetDataFromQueryArgs {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    vector: QdrantVector;
    limit?: number;
    filter?: Record<string, unknown>;
    with_payload?: QdrantWithPayload;
    withPayload?: QdrantWithPayload;
    with_vector?: QdrantWithVector;
    withVector?: QdrantWithVector;
    score_threshold?: number;
    offset?: QdrantPointId;
    params?: Record<string, unknown>;
    [key: string]: unknown;
}

interface GetDataArgs {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    limit?: number;
    offset?: QdrantPointId;
    filter?: Record<string, unknown>;
    with_payload?: QdrantWithPayload;
    withPayload?: QdrantWithPayload;
    with_vector?: QdrantWithVector;
    withVector?: QdrantWithVector;
    [key: string]: unknown;
}

interface GetDataByIdArgs {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    id: QdrantPointId | QdrantPointId[];
    with_payload?: QdrantWithPayload;
    withPayload?: QdrantWithPayload;
    with_vector?: QdrantWithVector;
    withVector?: QdrantWithVector;
}

interface UpdateByIdArgs {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    id: QdrantPointId | QdrantPointId[];
    updatedContent?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    wait?: boolean;
}

interface DeleteByIdArgs {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    id: QdrantPointId | QdrantPointId[];
    wait?: boolean;
}

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL || "";
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient(): QdrantClient {
        const url = this.QDRANT_URL.replace(/\/+$/, "");
        if (!url) {
            throw new Error("Qdrant URL is required. Pass QDRANT_URL or set process.env.QDRANT_URL.");
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        return {
            url,
            headers,
        };
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<unknown> {
        return this.request(client, `/collections/${this.encode(collectionName)}`, "PUT", {
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
        points,
        id,
        vector,
        payload,
        wait = true,
        ...payloadFields
    }: InsertVectorDataArgs): Promise<unknown> {
        const resolvedCollectionName = this.resolveCollectionName(collectionName, tableName);
        const resolvedPoints =
            points ||
            this.createSinglePoint({
                id,
                vector,
                payload: payload || this.objectWithValues(payloadFields),
            });

        return this.request(
            client,
            `/collections/${this.encode(resolvedCollectionName)}/points${this.waitQuery(wait)}`,
            "PUT",
            {
                points: resolvedPoints,
            }
        );
    }

    async getDataFromQuery({
        client,
        tableName,
        collectionName,
        vector,
        limit = 10,
        filter,
        with_payload,
        withPayload,
        with_vector,
        withVector,
        score_threshold,
        offset,
        params,
        ...searchOptions
    }: GetDataFromQueryArgs): Promise<unknown> {
        const resolvedCollectionName = this.resolveCollectionName(collectionName, tableName);

        return this.request(
            client,
            `/collections/${this.encode(resolvedCollectionName)}/points/search`,
            "POST",
            this.objectWithValues({
                vector,
                limit,
                filter,
                with_payload: with_payload ?? withPayload ?? true,
                with_vector: with_vector ?? withVector ?? false,
                score_threshold,
                offset,
                params,
                ...searchOptions,
            })
        );
    }

    async getData({
        client,
        tableName,
        collectionName,
        limit = 10,
        offset,
        filter,
        with_payload,
        withPayload,
        with_vector,
        withVector,
        ...scrollOptions
    }: GetDataArgs): Promise<unknown> {
        const resolvedCollectionName = this.resolveCollectionName(collectionName, tableName);

        return this.request(
            client,
            `/collections/${this.encode(resolvedCollectionName)}/points/scroll`,
            "POST",
            this.objectWithValues({
                limit,
                offset,
                filter,
                with_payload: with_payload ?? withPayload ?? true,
                with_vector: with_vector ?? withVector ?? false,
                ...scrollOptions,
            })
        );
    }

    async getDataById({
        client,
        tableName,
        collectionName,
        id,
        with_payload,
        withPayload,
        with_vector,
        withVector,
    }: GetDataByIdArgs): Promise<unknown> {
        const resolvedCollectionName = this.resolveCollectionName(collectionName, tableName);

        return this.request(
            client,
            `/collections/${this.encode(resolvedCollectionName)}/points`,
            "POST",
            {
                ids: this.arrayFrom(id),
                with_payload: with_payload ?? withPayload ?? true,
                with_vector: with_vector ?? withVector ?? false,
            }
        );
    }

    async updateById({
        client,
        tableName,
        collectionName,
        id,
        updatedContent,
        payload,
        wait = true,
    }: UpdateByIdArgs): Promise<unknown> {
        const resolvedCollectionName = this.resolveCollectionName(collectionName, tableName);
        const resolvedPayload = updatedContent || payload;

        if (!resolvedPayload) {
            throw new Error("Qdrant updateById requires updatedContent or payload.");
        }

        return this.request(
            client,
            `/collections/${this.encode(resolvedCollectionName)}/points/payload${this.waitQuery(wait)}`,
            "POST",
            {
                payload: resolvedPayload,
                points: this.arrayFrom(id),
            }
        );
    }

    async deleteById({
        client,
        tableName,
        collectionName,
        id,
        wait = true,
    }: DeleteByIdArgs): Promise<unknown> {
        const resolvedCollectionName = this.resolveCollectionName(collectionName, tableName);

        return this.request(
            client,
            `/collections/${this.encode(resolvedCollectionName)}/points/delete${this.waitQuery(wait)}`,
            "POST",
            {
                points: this.arrayFrom(id),
            }
        );
    }

    private async request(
        client: QdrantClient,
        path: string,
        method: RequestMethod,
        body?: Record<string, unknown>
    ): Promise<unknown> {
        const response = await fetch(`${client.url}${path}`, {
            method,
            headers: client.headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        const responseText = await response.text();
        const parsedResponse = this.parseResponse(responseText);

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with ${response.status} ${response.statusText}: ${responseText}`
            );
        }

        return parsedResponse;
    }

    private createSinglePoint({
        id,
        vector,
        payload,
    }: {
        id?: QdrantPointId;
        vector?: QdrantVector;
        payload?: Record<string, unknown>;
    }): QdrantPoint[] {
        if (id === undefined || id === null) {
            throw new Error("Qdrant insertVectorData requires id when points are not provided.");
        }
        if (!vector) {
            throw new Error("Qdrant insertVectorData requires vector when points are not provided.");
        }

        const point: QdrantPoint = {
            id,
            vector,
        };

        if (payload && Object.keys(payload).length > 0) {
            point.payload = payload;
        }

        return [point];
    }

    private resolveCollectionName(collectionName?: string, tableName?: string): string {
        const resolvedCollectionName = collectionName || tableName;

        if (!resolvedCollectionName) {
            throw new Error("Qdrant collectionName or tableName is required.");
        }

        return resolvedCollectionName;
    }

    private arrayFrom<T>(value: T | T[]): T[] {
        return Array.isArray(value) ? value : [value];
    }

    private waitQuery(wait: boolean): string {
        return wait ? "?wait=true" : "";
    }

    private encode(value: string): string {
        return encodeURIComponent(value);
    }

    private parseResponse(responseText: string): unknown {
        if (!responseText) {
            return {};
        }

        try {
            return JSON.parse(responseText);
        } catch {
            return responseText;
        }
    }

    private objectWithValues<T extends Record<string, unknown>>(object: T): Partial<T> {
        return Object.fromEntries(
            Object.entries(object).filter(([, value]) => value !== undefined)
        ) as Partial<T>;
    }
}

export type QdrantPointId = string | number;
export type QdrantVector = number[] | Record<string, number[]>;
export type QdrantDistance = "Cosine" | "Dot" | "Euclid" | "Manhattan";

export interface QdrantPoint {
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: Record<string, unknown>;
}

export interface QdrantHttpClient {
    baseUrl: string;
    apiKey?: string;
    fetch: typeof globalThis.fetch;
    timeoutMs: number;
}

export interface QdrantOptions {
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
}

interface CollectionArgs {
    client: QdrantHttpClient;
    collectionName?: string;
    tableName?: string;
}

interface CreateCollectionArgs extends CollectionArgs {
    vectorSize: number;
    distance?: QdrantDistance;
}

interface InsertVectorDataArgs extends CollectionArgs {
    points?: QdrantPoint[];
    id?: QdrantPointId;
    vector?: QdrantVector;
    payload?: Record<string, unknown>;
    wait?: boolean;
}

interface QueryArgs extends CollectionArgs {
    query?: QdrantVector;
    vector?: QdrantVector;
    limit?: number;
    filter?: Record<string, unknown>;
    params?: Record<string, unknown>;
    scoreThreshold?: number;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
}

interface ScrollArgs extends CollectionArgs {
    limit?: number;
    offset?: QdrantPointId;
    filter?: Record<string, unknown>;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
}

interface GetByIdArgs extends CollectionArgs {
    id: QdrantPointId;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
}

interface UpdateByIdArgs extends CollectionArgs {
    id: QdrantPointId;
    updatedContent?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    wait?: boolean;
}

interface DeleteByIdArgs extends CollectionArgs {
    id: QdrantPointId;
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;
    private readonly fetchImpl: typeof globalThis.fetch;
    private readonly timeoutMs: number;

    constructor(
        QDRANT_URL: string = process.env.QDRANT_URL || "http://localhost:6333",
        QDRANT_API_KEY: string = process.env.QDRANT_API_KEY || "",
        options: QdrantOptions = {}
    ) {
        this.QDRANT_URL = normalizeBaseUrl(QDRANT_URL);
        this.QDRANT_API_KEY = QDRANT_API_KEY || undefined;

        const fetchImpl = options.fetch || globalThis.fetch;
        if (typeof fetchImpl !== "function") {
            throw new Error("A fetch implementation is required to use Qdrant");
        }
        this.fetchImpl = fetchImpl.bind(globalThis);
        this.timeoutMs = options.timeoutMs ?? 30_000;
    }

    createClient(): QdrantHttpClient {
        return {
            baseUrl: this.QDRANT_URL,
            apiKey: this.QDRANT_API_KEY,
            fetch: this.fetchImpl,
            timeoutMs: this.timeoutMs,
        };
    }

    async createCollection({
        client,
        collectionName,
        tableName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
        const collection = resolveCollectionName(collectionName, tableName);
        if (!Number.isInteger(vectorSize) || vectorSize <= 0) {
            throw new Error("vectorSize must be a positive integer");
        }

        return this.request(client, "PUT", `/collections/${encodeURIComponent(collection)}`, {
            vectors: {
                size: vectorSize,
                distance,
            },
        });
    }

    async insertVectorData({
        client,
        collectionName,
        tableName,
        points,
        id,
        vector,
        payload,
        wait = true,
    }: InsertVectorDataArgs): Promise<any> {
        const collection = resolveCollectionName(collectionName, tableName);
        const normalizedPoints = points ?? (id !== undefined && vector ? [{ id, vector, payload }] : []);

        if (normalizedPoints.length === 0) {
            throw new Error("insertVectorData requires at least one point");
        }

        return this.request(
            client,
            "PUT",
            `/collections/${encodeURIComponent(collection)}/points?wait=${wait}`,
            { points: normalizedPoints }
        );
    }

    async getDataFromQuery({
        client,
        collectionName,
        tableName,
        query,
        vector,
        limit = 10,
        filter,
        params,
        scoreThreshold,
        withPayload = true,
        withVector = false,
    }: QueryArgs): Promise<any[]> {
        const collection = resolveCollectionName(collectionName, tableName);
        const queryVector = query ?? vector;
        if (!queryVector) {
            throw new Error("getDataFromQuery requires query or vector");
        }

        const body: Record<string, unknown> = {
            query: queryVector,
            limit,
            with_payload: withPayload,
            with_vector: withVector,
        };
        if (filter) body.filter = filter;
        if (params) body.params = params;
        if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold;

        const result = await this.request(
            client,
            "POST",
            `/collections/${encodeURIComponent(collection)}/points/query`,
            body
        );
        return Array.isArray(result) ? result : result?.points ?? [];
    }

    async getData({
        client,
        collectionName,
        tableName,
        limit = 10,
        offset,
        filter,
        withPayload = true,
        withVector = false,
    }: ScrollArgs): Promise<any> {
        const collection = resolveCollectionName(collectionName, tableName);
        const body: Record<string, unknown> = {
            limit,
            with_payload: withPayload,
            with_vector: withVector,
        };
        if (offset !== undefined) body.offset = offset;
        if (filter) body.filter = filter;

        return this.request(
            client,
            "POST",
            `/collections/${encodeURIComponent(collection)}/points/scroll`,
            body
        );
    }

    async getDataById({
        client,
        collectionName,
        tableName,
        id,
        withPayload = true,
        withVector = true,
    }: GetByIdArgs): Promise<any | null> {
        const collection = resolveCollectionName(collectionName, tableName);
        const result = await this.request(
            client,
            "POST",
            `/collections/${encodeURIComponent(collection)}/points`,
            {
                ids: [id],
                with_payload: withPayload,
                with_vector: withVector,
            }
        );
        return Array.isArray(result) ? (result[0] ?? null) : null;
    }

    async updateById({
        client,
        collectionName,
        tableName,
        id,
        updatedContent,
        payload,
        wait = true,
    }: UpdateByIdArgs): Promise<any> {
        const collection = resolveCollectionName(collectionName, tableName);
        const nextPayload = payload ?? updatedContent;
        if (!nextPayload) {
            throw new Error("updateById requires payload or updatedContent");
        }

        return this.request(
            client,
            "POST",
            `/collections/${encodeURIComponent(collection)}/points/payload?wait=${wait}`,
            {
                payload: nextPayload,
                points: [id],
            }
        );
    }

    async deleteById({
        client,
        collectionName,
        tableName,
        id,
        wait = true,
    }: DeleteByIdArgs): Promise<any> {
        const collection = resolveCollectionName(collectionName, tableName);
        return this.request(
            client,
            "POST",
            `/collections/${encodeURIComponent(collection)}/points/delete?wait=${wait}`,
            { points: [id] }
        );
    }

    // Qdrant-native aliases for callers that prefer explicit vector-database terminology.
    async upsert(args: InsertVectorDataArgs): Promise<any> {
        return this.insertVectorData(args);
    }

    async search(args: QueryArgs): Promise<any[]> {
        return this.getDataFromQuery(args);
    }

    async scroll(args: ScrollArgs): Promise<any> {
        return this.getData(args);
    }

    async retrieve(args: GetByIdArgs): Promise<any | null> {
        return this.getDataById(args);
    }

    async deletePoints(args: DeleteByIdArgs): Promise<any> {
        return this.deleteById(args);
    }

    private async request(
        client: QdrantHttpClient,
        method: string,
        path: string,
        body?: Record<string, unknown>
    ): Promise<any> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), client.timeoutMs);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (client.apiKey) headers["api-key"] = client.apiKey;

        let response: Response;
        try {
            response = await client.fetch(`${client.baseUrl}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
        } catch (error: any) {
            if (error?.name === "AbortError") {
                throw new Error(`Qdrant request timed out after ${client.timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }

        const text = await response.text();
        let payload: any = undefined;
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch {
                payload = text;
            }
        }

        if (!response.ok) {
            const detail = typeof payload === "string" ? payload : JSON.stringify(payload);
            throw new Error(`Qdrant request failed with status ${response.status}: ${detail}`);
        }

        return payload && typeof payload === "object" && "result" in payload
            ? payload.result
            : payload;
    }
}

function resolveCollectionName(collectionName?: string, tableName?: string): string {
    const collection = collectionName || tableName;
    if (!collection?.trim()) {
        throw new Error("collectionName or tableName is required");
    }
    return collection;
}

function normalizeBaseUrl(url: string): string {
    const normalized = url.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(normalized)) {
        throw new Error(`Qdrant URL must be an absolute http(s) URL, received: "${url}"`);
    }
    return normalized;
}

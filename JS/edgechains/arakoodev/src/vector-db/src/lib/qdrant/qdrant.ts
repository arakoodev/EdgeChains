export type QdrantPointId = string | number;

export interface QdrantPoint {
    id: QdrantPointId;
    vector?: number[];
    payload?: Record<string, unknown>;
}

export interface QdrantScoredPoint extends QdrantPoint {
    score: number;
}

export interface QdrantOptions {
    fetch?: typeof fetch;
    apiMode?: "query" | "search";
}

interface CollectionArgs {
    collectionName?: string;
    tableName?: string;
    name?: string;
    vectorSize?: number;
    size?: number;
    distance?: string;
}

interface PointArgs {
    collectionName?: string;
    tableName?: string;
    id?: QdrantPointId;
}

interface QueryArgs extends PointArgs {
    embedding?: number[];
    query?: number[];
    limit?: number;
    filter?: Record<string, unknown>;
    score_threshold?: number;
    scoreThreshold?: number;
    with_payload?: boolean;
    withPayload?: boolean;
}

interface ScrollArgs extends PointArgs {
    offset?: QdrantPointId;
    limit?: number;
    filter?: Record<string, unknown>;
    with_payload?: boolean;
    withPayload?: boolean;
    with_vector?: boolean;
    withVector?: boolean;
}

interface InsertVectorDataArgs extends PointArgs {
    embedding: number[];
    content?: unknown;
    metadata?: Record<string, unknown>;
    payload?: Record<string, unknown>;
}

interface UpdateArgs extends PointArgs {
    updatedContent?: Record<string, unknown>;
    payload?: Record<string, unknown>;
}

interface QdrantResponse<T> {
    result: T;
    status?: string;
    time?: number;
}

type FetchLike = (
    input: RequestInfo | URL,
    init?: RequestInit,
) => Promise<Response>;

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;
    private readonly requestFetch: FetchLike;
    private readonly apiMode: "query" | "search";

    constructor(
        QDRANT_URL: string,
        QDRANT_API_KEY?: string,
        options: QdrantOptions = {},
    ) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
        this.requestFetch = options.fetch || fetch;
        this.apiMode = options.apiMode || "query";

        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required");
        }
    }

    private collectionName(args: { collectionName?: string; tableName?: string; name?: string }) {
        const name = args.collectionName || args.tableName || args.name;
        if (!name) throw new Error("collectionName is required");
        return name;
    }

    private pointId(id: QdrantPointId | undefined): QdrantPointId {
        if (id === undefined || id === null || id === "") {
            throw new Error("id is required");
        }
        return id;
    }

    private collectionPath(name: string, suffix = "") {
        return `/collections/${encodeURIComponent(name)}${suffix}`;
    }

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const headers = new Headers(init.headers);
        headers.set("content-type", "application/json");
        if (this.QDRANT_API_KEY) headers.set("api-key", this.QDRANT_API_KEY);

        const response = await this.requestFetch(`${this.QDRANT_URL}${path}`, {
            ...init,
            headers,
        });
        const text = await response.text();
        let body: unknown;
        try {
            body = text ? JSON.parse(text) : undefined;
        } catch {
            body = text;
        }

        if (!response.ok) {
            const message =
                typeof body === "object" && body !== null && "status" in body
                    ? JSON.stringify(body)
                    : String(body || response.statusText || "Unknown error");
            throw new Error(`Qdrant request failed (${response.status}): ${message}`);
        }
        return body as T;
    }

    async createCollection({
        collectionName,
        tableName,
        name,
        vectorSize,
        size,
        distance = "Cosine",
    }: CollectionArgs): Promise<QdrantResponse<unknown>> {
        const collection = this.collectionName({ collectionName, tableName, name });
        const dimensions = vectorSize || size;
        if (!dimensions || dimensions <= 0) throw new Error("vectorSize is required");

        return this.request<QdrantResponse<unknown>>(
            this.collectionPath(collection),
            {
                method: "PUT",
                body: JSON.stringify({ vectors: { size: dimensions, distance } }),
            },
        );
    }

    async insertVectorData({
        collectionName,
        tableName,
        id,
        embedding,
        content,
        metadata,
        payload,
    }: InsertVectorDataArgs): Promise<QdrantResponse<unknown>> {
        const collection = this.collectionName({ collectionName, tableName });
        const pointId = this.pointId(id);
        const pointPayload =
            payload || {
                ...(content === undefined ? {} : { content }),
                ...(metadata || {}),
            };

        return this.request<QdrantResponse<unknown>>(
            `${this.collectionPath(collection, "/points")}?wait=true`,
            {
                method: "PUT",
                body: JSON.stringify({
                    points: [{ id: pointId, vector: embedding, payload: pointPayload }],
                }),
            },
        );
    }

    async getDataFromQuery({
        collectionName,
        tableName,
        embedding,
        query,
        limit = 10,
        filter,
        score_threshold,
        scoreThreshold,
        with_payload,
        withPayload,
    }: QueryArgs): Promise<QdrantScoredPoint[]> {
        const collection = this.collectionName({ collectionName, tableName });
        const vector = embedding || query;
        if (!vector) throw new Error("embedding is required");
        const includePayload = with_payload ?? withPayload ?? true;
        const body = {
            limit,
            filter,
            score_threshold: score_threshold ?? scoreThreshold,
            with_payload: includePayload,
        };

        const path =
            this.apiMode === "search"
                ? this.collectionPath(collection, "/points/search")
                : this.collectionPath(collection, "/points/query");
        const requestBody =
            this.apiMode === "search" ? { vector, ...body } : { query: vector, ...body };
        const requestInit: RequestInit = {
            method: "POST",
            body: JSON.stringify(requestBody),
        };

        if (this.apiMode === "search") {
            const response = await this.request<QdrantResponse<QdrantScoredPoint[]>>(
                path,
                requestInit,
            );
            return response.result;
        }

        const response = await this.request<
            QdrantResponse<{ points: QdrantScoredPoint[] }>
        >(path, requestInit);
        return response.result.points;
    }

    async scroll({
        collectionName,
        tableName,
        offset,
        limit = 100,
        filter,
        with_payload,
        withPayload,
        with_vector,
        withVector,
    }: ScrollArgs): Promise<{ points: QdrantPoint[]; next_page_offset?: QdrantPointId }> {
        const collection = this.collectionName({ collectionName, tableName });
        const response = await this.request<
            QdrantResponse<{ points: QdrantPoint[]; next_page_offset?: QdrantPointId }>
        >(this.collectionPath(collection, "/points/scroll"), {
            method: "POST",
            body: JSON.stringify({
                offset,
                limit,
                filter,
                with_payload: with_payload ?? withPayload ?? true,
                with_vector: with_vector ?? withVector ?? false,
            }),
        });
        return response.result;
    }

    async getData({
        collectionName,
        tableName,
        limit = 100,
        filter,
        with_payload,
        withPayload,
        with_vector,
        withVector,
    }: ScrollArgs): Promise<QdrantPoint[]> {
        const points: QdrantPoint[] = [];
        let offset: QdrantPointId | undefined;
        do {
            const page = await this.scroll({
                collectionName,
                tableName,
                offset,
                limit,
                filter,
                with_payload,
                withPayload,
                with_vector,
                withVector,
            });
            points.push(...page.points);
            offset = page.next_page_offset;
        } while (offset !== undefined && offset !== null);
        return points;
    }

    async getDataById({
        collectionName,
        tableName,
        id,
    }: PointArgs): Promise<QdrantPoint> {
        const collection = this.collectionName({ collectionName, tableName });
        const pointId = this.pointId(id);
        const response = await this.request<QdrantResponse<QdrantPoint>>(
            this.collectionPath(collection, `/points/${encodeURIComponent(String(pointId))}`),
        );
        return response.result;
    }

    async updateById({
        collectionName,
        tableName,
        id,
        updatedContent,
        payload,
    }: UpdateArgs): Promise<QdrantResponse<unknown>> {
        const collection = this.collectionName({ collectionName, tableName });
        const pointId = this.pointId(id);
        const nextPayload = payload || updatedContent;
        if (!nextPayload) throw new Error("updatedContent or payload is required");

        return this.request<QdrantResponse<unknown>>(
            `${this.collectionPath(collection, "/points/payload")}?wait=true`,
            {
                method: "POST",
                body: JSON.stringify({ points: [pointId], payload: nextPayload }),
            },
        );
    }

    async deleteById({
        collectionName,
        tableName,
        id,
    }: PointArgs): Promise<QdrantResponse<unknown>> {
        const collection = this.collectionName({ collectionName, tableName });
        const pointId = this.pointId(id);
        return this.request<QdrantResponse<unknown>>(
            `${this.collectionPath(collection, "/points/delete")}?wait=true`,
            {
                method: "POST",
                body: JSON.stringify({ points: [pointId] }),
            },
        );
    }
}

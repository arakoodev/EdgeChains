export type QdrantPointId = number | string;
export type QdrantPayload = Record<string, unknown>;
export type QdrantVector = number[] | Record<string, number[]>;

export interface QdrantPoint {
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: QdrantPayload;
}

export interface QdrantRecord {
    id: QdrantPointId;
    payload?: QdrantPayload | null;
    vector?: QdrantVector | null;
}

export interface QdrantScoredPoint extends QdrantRecord {
    score: number;
    version: number;
}

export interface QdrantSearchOptions {
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
    using?: string;
    score_threshold?: number;
    with_payload?: boolean | string[];
    with_vector?: boolean | string[];
}

export interface QdrantOptions {
    url: string;
    apiKey?: string;
    /** Maximum time for the entire HTTP request, including the response body. */
    timeoutMs?: number;
}

export interface QdrantOperation {
    operation_id: number | null;
    status: string;
}

/** Direct REST client for Qdrant >= 1.10. No Qdrant SDK is required. */
export class Qdrant {
    private readonly baseUrl: string;
    private readonly apiKey?: string;
    private readonly timeoutMs: number;

    constructor({ url, apiKey, timeoutMs = 30000 }: QdrantOptions) {
        const parsed = new URL(url);
        if (
            !["http:", "https:"].includes(parsed.protocol) ||
            parsed.username ||
            parsed.password ||
            parsed.search ||
            parsed.hash
        ) {
            throw new TypeError(
                "Qdrant URL must be HTTP(S), without credentials, query or fragment"
            );
        }
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) {
            throw new RangeError("timeoutMs must be a positive integer <= 2147483647");
        }
        this.baseUrl = parsed.href.replace(/\/+$/, "");
        this.apiKey = apiKey;
        this.timeoutMs = timeoutMs;
    }

    private collectionPath(collection: string): string {
        if (!collection || collection === "." || collection === "..") {
            throw new TypeError("A nonempty collection name is required");
        }
        return `/collections/${encodeURIComponent(collection)}`;
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await fetch(`${this.baseUrl}${path}`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...(this.apiKey ? { "api-key": this.apiKey } : {}),
                },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: controller.signal,
                redirect: "error",
            });
            if (!response.ok) {
                // Consume the body so the connection can be reused; do not expose server text
                // that may contain a submitted embedding, prompt or credential.
                await response.text();
                throw new Error(`Qdrant ${method} request failed (HTTP ${response.status})`);
            }
            const envelope = await response.json();
            if (
                !envelope ||
                typeof envelope !== "object" ||
                envelope.status !== "ok" ||
                !Object.hasOwn(envelope, "result")
            ) {
                throw new Error("Invalid Qdrant response: expected a successful result envelope");
            }
            return envelope.result as T;
        } finally {
            clearTimeout(timer);
        }
    }

    createCollection(
        collection: string,
        vectors:
            | { size: number; distance: "Cosine" | "Euclid" | "Dot" | "Manhattan" }
            | Record<string, { size: number; distance: "Cosine" | "Euclid" | "Dot" | "Manhattan" }>
    ): Promise<boolean> {
        return this.request("PUT", this.collectionPath(collection), { vectors });
    }

    deleteCollection(collection: string): Promise<boolean> {
        return this.request("DELETE", this.collectionPath(collection));
    }

    listCollections(): Promise<{ collections: { name: string }[] }> {
        return this.request("GET", "/collections");
    }

    /** Wait for persistence before resolving, so a following search observes the write. */
    upsert(collection: string, points: QdrantPoint[]): Promise<QdrantOperation> {
        for (const point of points) {
            this.validateId(point.id);
            const vectors = Array.isArray(point.vector)
                ? [point.vector]
                : Object.values(point.vector);
            if (!vectors.length) throw new TypeError("At least one vector is required");
            vectors.forEach((vector) => this.validateVector(vector));
        }
        return this.request("PUT", `${this.collectionPath(collection)}/points?wait=true`, {
            points,
        });
    }

    async search(
        collection: string,
        vector: number[],
        options: QdrantSearchOptions = {}
    ): Promise<QdrantScoredPoint[]> {
        this.validateVector(vector);
        const { limit = 10, offset, score_threshold } = options;
        if (!Number.isSafeInteger(limit) || limit <= 0)
            throw new RangeError("limit must be a positive integer");
        if (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0))
            throw new RangeError("offset must be a nonnegative integer");
        if (score_threshold !== undefined && !Number.isFinite(score_threshold))
            throw new RangeError("score_threshold must be finite");
        const result = await this.request<{ points: QdrantScoredPoint[] }>(
            "POST",
            `${this.collectionPath(collection)}/points/query`,
            { with_payload: true, ...options, query: vector, limit }
        );
        if (!result || !Array.isArray(result.points))
            throw new Error("Invalid Qdrant query result");
        return result.points;
    }

    retrieve(collection: string, ids: QdrantPointId[]): Promise<QdrantRecord[]> {
        ids.forEach((id) => this.validateId(id));
        return this.request("POST", `${this.collectionPath(collection)}/points`, {
            ids,
            with_payload: true,
            with_vector: true,
        });
    }

    deletePoints(collection: string, ids: QdrantPointId[]): Promise<QdrantOperation> {
        ids.forEach((id) => this.validateId(id));
        return this.request("POST", `${this.collectionPath(collection)}/points/delete?wait=true`, {
            points: ids,
        });
    }

    setPayload(
        collection: string,
        ids: QdrantPointId[],
        payload: QdrantPayload
    ): Promise<QdrantOperation> {
        ids.forEach((id) => this.validateId(id));
        return this.request("POST", `${this.collectionPath(collection)}/points/payload?wait=true`, {
            points: ids,
            payload,
        });
    }

    private validateId(id: QdrantPointId): void {
        if (
            typeof id === "number"
                ? !Number.isSafeInteger(id) || id < 0
                : typeof id !== "string" || !id
        ) {
            throw new TypeError("Point IDs must be nonnegative safe integers or UUID strings");
        }
    }

    private validateVector(vector: number[]): void {
        if (
            !Array.isArray(vector) ||
            !vector.length ||
            Array.from(vector).some((value) => !Number.isFinite(value))
        ) {
            throw new TypeError("Vectors must be nonempty arrays of finite numbers");
        }
    }
}

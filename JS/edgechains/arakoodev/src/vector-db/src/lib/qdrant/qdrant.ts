export type QdrantPointId = string | number;

export interface QdrantPoint {
    id: QdrantPointId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, unknown>;
}

export interface QdrantScoredPoint extends QdrantPoint {
    score: number;
}

export interface QdrantCollectionOptions {
    size: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

export interface QdrantQueryOptions {
    limit?: number;
    filter?: Record<string, unknown>;
    withPayload?: boolean;
    withVector?: boolean;
}

export interface QdrantOptions {
    url: string;
    apiKey?: string;
    fetcher?: typeof fetch;
}

export class Qdrant {
    private readonly baseUrl: string;
    private readonly apiKey?: string;
    private readonly fetcher: typeof fetch;

    constructor(options: QdrantOptions) {
        const url = new URL(options.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            throw new Error("Qdrant URL must use HTTP or HTTPS");
        }
        this.baseUrl = url.toString().replace(/\/$/, "");
        this.apiKey = options.apiKey;
        this.fetcher = options.fetcher || fetch;
    }

    createCollection(name: string, options: QdrantCollectionOptions) {
        if (!Number.isSafeInteger(options.size) || options.size < 1) {
            throw new Error("Qdrant vector size must be a positive integer");
        }
        return this.request("PUT", `/collections/${collection(name)}`, {
            vectors: { size: options.size, distance: options.distance || "Cosine" },
        });
    }

    upsert(name: string, points: QdrantPoint[], wait = true) {
        if (!points.length) throw new Error("At least one Qdrant point is required");
        return this.request("PUT", `/collections/${collection(name)}/points?wait=${wait}`, {
            points,
        });
    }

    query(
        name: string,
        vector: number[] | Record<string, unknown>,
        options: QdrantQueryOptions = {}
    ): Promise<QdrantScoredPoint[]> {
        return this.request<{ points: QdrantScoredPoint[] }>(
            "POST",
            `/collections/${collection(name)}/points/query`,
            {
                query: vector,
                limit: options.limit ?? 10,
                filter: options.filter,
                with_payload: options.withPayload ?? true,
                with_vector: options.withVector ?? false,
            }
        ).then((result) => result.points);
    }

    retrieve(
        name: string,
        ids: QdrantPointId[],
        withPayload = true,
        withVector = false
    ): Promise<QdrantPoint[]> {
        if (!ids.length) throw new Error("At least one Qdrant point ID is required");
        return this.request("POST", `/collections/${collection(name)}/points`, {
            ids,
            with_payload: withPayload,
            with_vector: withVector,
        });
    }

    delete(name: string, ids: QdrantPointId[], wait = true) {
        if (!ids.length) throw new Error("At least one Qdrant point ID is required");
        return this.request("POST", `/collections/${collection(name)}/points/delete?wait=${wait}`, {
            points: ids,
        });
    }

    private async request<T = unknown>(method: string, path: string, body: unknown): Promise<T> {
        const response = await this.fetcher(`${this.baseUrl}${path}`, {
            method,
            headers: {
                "content-type": "application/json",
                ...(this.apiKey ? { "api-key": this.apiKey } : {}),
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            const detail = await response.text();
            throw new Error(
                `Qdrant returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`
            );
        }
        const payload = (await response.json()) as { result: T };
        return payload.result;
    }
}

function collection(name: string): string {
    const value = name.trim();
    if (!value) throw new Error("Qdrant collection name cannot be empty");
    return encodeURIComponent(value);
}

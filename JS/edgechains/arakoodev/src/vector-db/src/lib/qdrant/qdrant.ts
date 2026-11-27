export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, unknown>;
}

export interface QdrantSearchResult {
    id: string | number;
    score: number;
    payload?: Record<string, unknown> | null;
}

export type QdrantFetch = (url: string, init?: any) => Promise<any>;

export interface QdrantOptions {
    url?: string;
    apiKey?: string;
    /** Injectable fetch implementation (defaults to global fetch). */
    fetch?: QdrantFetch;
}

/**
 * Thin wrapper over the Qdrant REST API (https://api.qdrant.tech).
 */
export class Qdrant {
    private url: string;
    private apiKey?: string;
    private fetchFn: QdrantFetch;

    constructor(options: QdrantOptions = {}) {
        this.url = (options.url || process.env.QDRANT_URL || "http://localhost:6333").replace(
            /\/+$/,
            "",
        );
        this.apiKey = options.apiKey || process.env.QDRANT_API_KEY;
        this.fetchFn = options.fetch || ((url, init) => fetch(url, init));
    }

    private async request(method: string, path: string, body?: unknown): Promise<any> {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (this.apiKey) headers["api-key"] = this.apiKey;
        const res = await this.fetchFn(`${this.url}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok) {
            const text = typeof res.text === "function" ? await res.text() : "";
            throw new Error(`Qdrant request failed (${res.status}): ${text}`);
        }
        return res.json();
    }

    async collectionExists(name: string): Promise<boolean> {
        const res = await this.request("GET", `/collections/${encodeURIComponent(name)}/exists`);
        return Boolean(res?.result?.exists);
    }

    /** Creates the collection if it does not exist yet. Returns true if created. */
    async ensureCollection(
        name: string,
        size: number,
        distance: "Cosine" | "Euclid" | "Dot" | "Manhattan" = "Cosine",
    ): Promise<boolean> {
        if (await this.collectionExists(name)) return false;
        await this.request("PUT", `/collections/${encodeURIComponent(name)}`, {
            vectors: { size, distance },
        });
        return true;
    }

    async upsert(collection: string, points: QdrantPoint[]): Promise<void> {
        await this.request(
            "PUT",
            `/collections/${encodeURIComponent(collection)}/points?wait=true`,
            {
                points,
            },
        );
    }

    async search(
        collection: string,
        vector: number[],
        options: { limit?: number; filter?: Record<string, unknown> } = {},
    ): Promise<QdrantSearchResult[]> {
        const res = await this.request(
            "POST",
            `/collections/${encodeURIComponent(collection)}/points/search`,
            {
                vector,
                limit: options.limit ?? 10,
                filter: options.filter,
                with_payload: true,
            },
        );
        return (res.result ?? []).map((r: any) => ({
            id: r.id,
            score: r.score,
            payload: r.payload,
        }));
    }

    async deleteByIds(collection: string, ids: Array<string | number>): Promise<void> {
        await this.request(
            "POST",
            `/collections/${encodeURIComponent(collection)}/points/delete?wait=true`,
            { points: ids },
        );
    }
}

/**
 * Qdrant vector search client analogous to PostgresClient.
 * Talks to the Qdrant HTTP API directly (no @qdrant/* packages).
 * REST reference: https://qdrant.tech/documentation/
 */

export enum QdrantDistanceMetric {
    COSINE = "COSINE",
    IP = "IP",
    L2 = "L2",
}

export type QdrantFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface QdrantClientOptions {
    /** Base URL of the Qdrant instance, e.g. http://localhost:6333 */
    url?: string;
    /** Optional Qdrant API key (sent as `api-key` header) */
    apiKey?: string;
    /** Injectable fetch for tests / non-Node runtimes */
    fetch?: QdrantFetch;
    /** Request timeout in milliseconds */
    timeoutMs?: number;
}

export interface QdrantSearchHit {
    id: string | number;
    score: number;
    raw_text?: string;
    filename?: string;
    namespace?: string;
    metadata?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    rrf_score?: number;
    [key: string]: unknown;
}

interface QdrantPointResult {
    id: string | number;
    score?: number;
    payload?: Record<string, unknown> | null;
    vector?: number[] | Record<string, number[]>;
}

/**
 * Hyde / RAG style vector search against a Qdrant collection.
 * Mirrors the constructor shape of PostgresClient so callers can swap stores.
 */
export class QdrantClient {
    wordEmbeddings: number[][];
    metric: QdrantDistanceMetric;
    topK: number;
    /** Retained for PostgresClient signature parity (maps to HNSW ef when set). */
    probes: number;
    tableName: string;
    namespace: string;
    arkRequest: any;
    upperLimit: number;
    url: string;
    apiKey?: string;
    private readonly fetchImpl: QdrantFetch;
    private readonly timeoutMs?: number;

    constructor(
        wordEmbeddings: number[][],
        metric: QdrantDistanceMetric,
        topK: number,
        probes: number,
        tableName: string,
        namespace: string,
        arkRequest: any,
        upperLimit: number,
        options: QdrantClientOptions = {}
    ) {
        this.wordEmbeddings = wordEmbeddings;
        this.metric = metric;
        this.topK = topK;
        this.probes = probes;
        this.tableName = tableName;
        this.namespace = namespace;
        this.arkRequest = arkRequest;
        this.upperLimit = upperLimit;
        this.url = normalizeBaseUrl(
            options.url || process.env.QDRANT_URL || "http://localhost:6333"
        );
        this.apiKey = options.apiKey || process.env.QDRANT_API_KEY;
        const fetchImpl = options.fetch || globalThis.fetch;
        if (typeof fetchImpl !== "function") {
            throw new Error("A fetch implementation is required to use QdrantClient");
        }
        this.fetchImpl = fetchImpl.bind(globalThis);
        this.timeoutMs = options.timeoutMs;
    }

    /**
     * Search the Qdrant collection for each embedding and merge results.
     * When multiple embeddings are provided, Reciprocal Rank Fusion (RRF)
     * is applied — similar in spirit to PostgresClient's RRF scoring.
     */
    async dbQuery(): Promise<QdrantSearchHit[]> {
        if (!this.wordEmbeddings?.length) {
            return [];
        }

        const perEmbeddingHits = await Promise.all(
            this.wordEmbeddings.map((embedding) => this.searchOne(embedding))
        );

        if (perEmbeddingHits.length === 1) {
            return perEmbeddingHits[0].slice(0, this.topK);
        }

        return fuseRrf(perEmbeddingHits, this.upperLimit || this.topK);
    }

    private async searchOne(embedding: number[]): Promise<QdrantSearchHit[]> {
        const filter = {
            must: [
                {
                    key: "namespace",
                    match: { value: this.namespace },
                },
            ],
        };

        const body: Record<string, unknown> = {
            vector: embedding,
            limit: this.topK,
            with_payload: true,
            with_vector: false,
            filter,
        };

        // Map Postgres-style probes to Qdrant HNSW search ef when provided.
        if (this.probes && this.probes > 0) {
            body.params = { hnsw_ef: this.probes };
        }

        const result = await this.request<QdrantPointResult[]>(
            "POST",
            `/collections/${encodeURIComponent(this.tableName)}/points/search`,
            body
        );

        return (result || []).map((point) => mapPoint(point));
    }

    private async request<T>(
        method: string,
        path: string,
        body?: Record<string, unknown>
    ): Promise<T> {
        const url = `${this.url}${path}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }

        const controller = new AbortController();
        const timer =
            this.timeoutMs !== undefined
                ? setTimeout(() => controller.abort(), this.timeoutMs)
                : undefined;

        let response: Response;
        try {
            response = await this.fetchImpl(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
        } catch (error: any) {
            if (error?.name === "AbortError") {
                throw new Error(`Qdrant request timed out after ${this.timeoutMs}ms`);
            }
            throw error;
        } finally {
            if (timer) clearTimeout(timer);
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

        if (payload && typeof payload === "object" && "result" in payload) {
            return payload.result as T;
        }
        return payload as T;
    }
}

function mapPoint(point: QdrantPointResult): QdrantSearchHit {
    const payload = (point.payload || {}) as Record<string, unknown>;
    return {
        id: point.id,
        score: point.score ?? 0,
        raw_text: (payload.raw_text as string) ?? (payload.content as string) ?? (payload.text as string),
        filename: payload.filename as string | undefined,
        namespace: payload.namespace as string | undefined,
        metadata: (payload.metadata as Record<string, unknown>) ?? undefined,
        payload,
        ...payload,
    };
}

/**
 * Reciprocal Rank Fusion across multiple ranked hit lists.
 * score_i = sum_r 1 / (k + rank_r(i)) with k = 60 (classic RRF constant).
 */
function fuseRrf(lists: QdrantSearchHit[][], limit: number): QdrantSearchHit[] {
    const k = 60;
    const scores = new Map<string | number, { hit: QdrantSearchHit; rrf: number }>();

    for (const list of lists) {
        list.forEach((hit, index) => {
            const existing = scores.get(hit.id);
            const add = 1 / (k + index + 1);
            if (existing) {
                existing.rrf += add;
                if ((hit.score ?? 0) > (existing.hit.score ?? 0)) {
                    existing.hit = hit;
                }
            } else {
                scores.set(hit.id, { hit, rrf: add });
            }
        });
    }

    return Array.from(scores.values())
        .sort((a, b) => b.rrf - a.rrf)
        .slice(0, limit)
        .map(({ hit, rrf }) => ({ ...hit, rrf_score: rrf }));
}

function normalizeBaseUrl(url: string): string {
    const trimmed = url.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error(`Qdrant URL must be an absolute http(s) URL, received: "${url}"`);
    }
    return trimmed;
}

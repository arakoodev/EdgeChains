export enum QdrantDistanceMetric {
    COSINE = "COSINE",
    IP = "IP",
    L2 = "L2",
}

export interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
}

export interface QdrantSearchHit {
    id: string | number;
    score: number;
    rrf_score?: number;
    payload?: Record<string, unknown>;
    [key: string]: unknown;
}

export class QdrantClient {
    wordEmbeddings: number[][];
    metric: QdrantDistanceMetric;
    topK: number;
    probes: number;
    tableName: string;
    namespace: string;
    arkRequest: any;
    upperLimit: number;
    url: string;
    apiKey?: string;
    private readonly fetchImpl: typeof globalThis.fetch;
    private readonly timeoutMs: number;

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
        this.url = normalizeBaseUrl(options.url || process.env.QDRANT_URL || "http://localhost:6333");
        this.apiKey = options.apiKey || process.env.QDRANT_API_KEY;

        const fetchImpl = options.fetch || globalThis.fetch;
        if (typeof fetchImpl !== "function") {
            throw new Error("A fetch implementation is required to use QdrantClient");
        }
        this.fetchImpl = fetchImpl.bind(globalThis);
        this.timeoutMs = options.timeoutMs ?? 30_000;
    }

    async dbQuery(): Promise<QdrantSearchHit[]> {
        if (!this.wordEmbeddings.length) return [];

        const rankedLists = await Promise.all(
            this.wordEmbeddings.map((embedding) => this.searchEmbedding(embedding))
        );

        if (rankedLists.length === 1) {
            return rankedLists[0].slice(0, this.topK);
        }

        return reciprocalRankFuse(rankedLists, this.upperLimit || this.topK);
    }

    private async searchEmbedding(embedding: number[]): Promise<QdrantSearchHit[]> {
        const body: Record<string, unknown> = {
            query: embedding,
            limit: this.topK,
            with_payload: true,
            with_vector: false,
            filter: {
                must: [{ key: "namespace", match: { value: this.namespace } }],
            },
        };

        if (this.probes > 0) {
            body.params = { hnsw_ef: this.probes };
        }

        const response = await this.request(
            "POST",
            `/collections/${encodeURIComponent(this.tableName)}/points/query`,
            body
        );
        const points = Array.isArray(response) ? response : response?.points ?? [];
        return points.map(mapPoint);
    }

    private async request(
        method: string,
        path: string,
        body?: Record<string, unknown>
    ): Promise<any> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (this.apiKey) headers["api-key"] = this.apiKey;

        let response: Response;
        try {
            response = await this.fetchImpl(`${this.url}${path}`, {
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

function mapPoint(point: any): QdrantSearchHit {
    const payload = (point?.payload || {}) as Record<string, unknown>;
    return {
        id: point.id,
        score: point.score ?? 0,
        payload,
        ...payload,
    };
}

function reciprocalRankFuse(lists: QdrantSearchHit[][], limit: number): QdrantSearchHit[] {
    const k = 60;
    const merged = new Map<string | number, { hit: QdrantSearchHit; score: number }>();

    for (const list of lists) {
        list.forEach((hit, index) => {
            const increment = 1 / (k + index + 1);
            const current = merged.get(hit.id);
            if (!current) {
                merged.set(hit.id, { hit, score: increment });
                return;
            }
            current.score += increment;
            if ((hit.score ?? 0) > (current.hit.score ?? 0)) current.hit = hit;
        });
    }

    return [...merged.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ hit, score }) => ({ ...hit, rrf_score: score }));
}

function normalizeBaseUrl(url: string): string {
    const normalized = url.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(normalized)) {
        throw new Error(`Qdrant URL must be an absolute http(s) URL, received: "${url}"`);
    }
    return normalized;
}

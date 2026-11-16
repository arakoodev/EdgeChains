export type QdrantPointId = number | string;
export interface QdrantPoint {
    id: QdrantPointId;
    vector: number[];
    payload?: Record<string, unknown>;
}
export interface QdrantSearchResult {
    id: QdrantPointId;
    score: number;
    payload?: Record<string, unknown> | null;
    vector?: number[] | null;
}
export interface QdrantOptions {
    url: string;
    apiKey?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
}
export interface QdrantSearchOptions {
    limit?: number;
    filter?: Record<string, unknown>;
    scoreThreshold?: number;
    withPayload?: boolean;
    withVector?: boolean;
    signal?: AbortSignal;
}

/** Direct Qdrant REST transport; no Qdrant SDK or embedding service is required. */
export class Qdrant {
    private readonly url: string;
    private readonly apiKey?: string;
    private readonly timeoutMs: number;
    private readonly transport: typeof fetch;

    constructor(options: QdrantOptions) {
        const url = new URL(options.url);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
            throw new TypeError('Qdrant URL must be HTTP(S), without credentials, query or fragment');
        }
        this.url = url.href.replace(/\/+$/, '');
        this.apiKey = options.apiKey;
        this.timeoutMs = options.timeoutMs ?? 10000;
        if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
            throw new RangeError('timeoutMs must be a positive safe integer');
        }
        this.transport = options.fetch ?? globalThis.fetch;
        if (!this.transport) throw new Error('Qdrant requires a fetch implementation (Node 18+)');
    }

    private collection(name: string) {
        if (!name.trim() || name === '.' || name === '..') throw new TypeError('Invalid collection name');
        return `/collections/${encodeURIComponent(name)}`;
    }

    private vector(vector: number[]) {
        if (!Array.isArray(vector) || !vector.length || !vector.every(Number.isFinite)) {
            throw new TypeError('Vector must contain finite numbers');
        }
    }

    private async request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
        const controller = new AbortController();
        const abort = () => controller.abort(signal?.reason);
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await this.transport(`${this.url}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey ? { 'api-key': this.apiKey } : {}),
                },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: controller.signal,
                redirect: 'error',
            });
            // Do not include response bodies, URLs or credentials in thrown errors.
            if (!response.ok) throw new Error(`Qdrant HTTP ${response.status}`);
            const envelope: unknown = await response.json();
            if (!envelope || typeof envelope !== 'object' || !('status' in envelope) ||
                envelope.status !== 'ok' || !('result' in envelope)) {
                throw new Error('Invalid Qdrant response');
            }
            return envelope.result as T;
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
        }
    }

    async createCollection(name: string, size: number, distance: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan' = 'Cosine') {
        if (!Number.isSafeInteger(size) || size <= 0) throw new RangeError('Vector size must be positive');
        if (!['Cosine', 'Euclid', 'Dot', 'Manhattan'].includes(distance)) throw new TypeError('Invalid distance');
        return this.request<boolean>('PUT', this.collection(name), { vectors: { size, distance } });
    }

    async getCollection(name: string) {
        return this.request<Record<string, unknown>>('GET', this.collection(name));
    }

    async deleteCollection(name: string) {
        return this.request<boolean>('DELETE', this.collection(name));
    }

    async upsert(name: string, points: QdrantPoint[], signal?: AbortSignal) {
        if (!points.length) throw new TypeError('At least one point is required');
        for (const point of points) {
            this.vector(point.vector);
            this.pointId(point.id);
        }
        return this.request<{ operation_id: number; status: string }>('PUT', `${this.collection(name)}/points?wait=true`, { points }, signal);
    }

    async search(name: string, vector: number[], options: QdrantSearchOptions = {}) {
        this.vector(vector);
        const limit = options.limit ?? 10;
        if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError('Search limit must be positive');
        if (options.scoreThreshold !== undefined && !Number.isFinite(options.scoreThreshold)) {
            throw new TypeError('Score threshold must be finite');
        }
        return this.request<QdrantSearchResult[]>('POST', `${this.collection(name)}/points/search`, {
            vector,
            limit,
            filter: options.filter,
            score_threshold: options.scoreThreshold,
            with_payload: options.withPayload ?? true,
            with_vector: options.withVector ?? false,
        }, options.signal);
    }

    async deletePoints(name: string, points: QdrantPointId[], signal?: AbortSignal) {
        if (!points.length) throw new TypeError('At least one point ID is required');
        points.forEach(id => this.pointId(id));
        return this.request<{ operation_id: number; status: string }>('POST', `${this.collection(name)}/points/delete?wait=true`, { points }, signal);
    }

    private pointId(id: QdrantPointId) {
        if (typeof id === 'number' ? !Number.isSafeInteger(id) || id < 0 :
            typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            throw new TypeError('Point ID must be a nonnegative safe integer or UUID');
        }
    }
}

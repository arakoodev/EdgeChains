import retry from "retry";
import { config } from "dotenv";
config();

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export class QdrantClient {
    readonly url: string;
    readonly apiKey?: string;

    constructor(url: string, apiKey?: string) {
        if (!url) throw new Error("QdrantClient requires a URL (e.g. http://localhost:6333)");
        this.url = url.replace(/\/+$/, "");
        this.apiKey = apiKey || process.env.QDRANT_API_KEY;
    }

    private headers(): Record<string, string> {
        const h: Record<string, string> = { "Content-Type": "application/json" };
        if (this.apiKey) h["api-key"] = this.apiKey;
        return h;
    }

    async request(method: string, path: string, body?: any): Promise<any> {
        const res = await fetch(`${this.url}${path}`, {
            method,
            headers: this.headers(),
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        let json: any;
        if (text) { try { json = JSON.parse(text); } catch { json = { raw: text }; } }
        if (!res.ok) {
            const msg = json?.status?.error || json?.error || text || res.statusText;
            throw new Error(`Qdrant ${method} ${path} failed (${res.status}): ${msg}`);
        }
        return json;
    }

    async createCollection(collectionName: string, vectorSize: number, distance = "Cosine"): Promise<any> {
        return this.request("PUT", `/collections/${encodeURIComponent(collectionName)}`, { vectors: { size: vectorSize, distance } });
    }
    async collectionExists(collectionName: string): Promise<boolean> {
        try { const r = await this.request("GET", `/collections/${encodeURIComponent(collectionName)}`); return Boolean(r?.result); }
        catch { return false; }
    }
    async deleteCollection(collectionName: string): Promise<any> {
        return this.request("DELETE", `/collections/${encodeURIComponent(collectionName)}`);
    }
    async upsertPoints(collectionName: string, points: QdrantPoint[]): Promise<any> {
        return this.request("PUT", `/collections/${encodeURIComponent(collectionName)}/points?wait=true`, { points });
    }
    async getPoint(collectionName: string, id: string | number, withPayload = true, withVector = false): Promise<any> {
        return this.request("GET", `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(String(id))}?with_payload=${withPayload}&with_vector=${withVector}`);
    }
    async scrollPoints(collectionName: string, opts: { limit?: number; offset?: number | string; withPayload?: boolean; withVector?: boolean } = {}): Promise<any> {
        const { limit = 10, offset, withPayload = true, withVector = false } = opts;
        return this.request("POST", `/collections/${encodeURIComponent(collectionName)}/points/scroll`, { limit, offset: offset ?? null, with_payload: withPayload, with_vector: withVector });
    }
    async deletePoints(collectionName: string, ids: (string | number)[]): Promise<any> {
        return this.request("POST", `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=true`, { points: ids });
    }
    async search(collectionName: string, args: { vector: number[]; limit?: number; scoreThreshold?: number; withPayload?: boolean; filter?: Record<string, any> }): Promise<any> {
        const { vector, limit = 10, scoreThreshold, withPayload = true, filter } = args;
        const body: Record<string, any> = { vector, limit, with_payload: withPayload };
        if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold;
        if (filter !== undefined) body.filter = filter;
        return this.request("POST", `/collections/${encodeURIComponent(collectionName)}/points/search`, body);
    }
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;
    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333";
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }
    createClient(): QdrantClient { return new QdrantClient(this.QDRANT_URL, this.QDRANT_API_KEY); }

    private _withRetry<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({ retries: 5, factor: 3, minTimeout: 1000, maxTimeout: 60000, randomize: true });
            operation.attempt(async () => {
                try { resolve(await fn()); } catch (error: any) { if (operation.retry(error)) return; reject(error); }
            });
        });
    }

    async insertVectorData({ client, collectionName, points }: { client: QdrantClient; collectionName: string; points: QdrantPoint[]; }): Promise<any> {
        if (!points || points.length === 0) throw new Error("insertVectorData requires at least one point");
        return this._withRetry(() => client.upsertPoints(collectionName, points));
    }
    async getDataById({ client, collectionName, id }: { client: QdrantClient; collectionName: string; id: string | number; }): Promise<any> {
        return this._withRetry(() => client.getPoint(collectionName, id));
    }
    async getData({ client, collectionName, limit, offset, withPayload, withVector }: { client: QdrantClient; collectionName: string; limit?: number; offset?: number | string; withPayload?: boolean; withVector?: boolean; }): Promise<any> {
        return this._withRetry(() => client.scrollPoints(collectionName, { limit, offset, withPayload, withVector }));
    }
    async updateById({ client, collectionName, point }: { client: QdrantClient; collectionName: string; point: QdrantPoint; }): Promise<any> {
        return this._withRetry(() => client.upsertPoints(collectionName, [point]));
    }
    async deleteById({ client, collectionName, id }: { client: QdrantClient; collectionName: string; id: string | number; }): Promise<any> {
        return this._withRetry(() => client.deletePoints(collectionName, [id]));
    }
    async getDataFromQuery({ client, collectionName, vector, limit, scoreThreshold, withPayload, filter }: { client: QdrantClient; collectionName: string; vector: number[]; limit?: number; scoreThreshold?: number; withPayload?: boolean; filter?: Record<string, any>; }): Promise<any> {
        return this._withRetry(() => client.search(collectionName, { vector, limit, scoreThreshold, withPayload, filter }));
    }
    async similaritySearch(args: any): Promise<any> { return this.getDataFromQuery(args); }
    async search(args: any): Promise<any> { return this.getDataFromQuery(args); }
}

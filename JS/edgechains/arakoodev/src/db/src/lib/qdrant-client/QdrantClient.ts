export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    DOT = "Dot",
    EUCLID = "Euclid",
}

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantSearchParams {
    collectionName: string;
    vector: number[];
    topK?: number;
    scoreThreshold?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
}

export interface QdrantClientConfig {
    url?: string;
    apiKey?: string;
}

export class QdrantClient {
    private url: string;
    private apiKey?: string;

    constructor(config: QdrantClientConfig = {}) {
        this.url = (config.url || "http://localhost:6333").replace(/\/$/, "");
        this.apiKey = config.apiKey;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }
        return headers;
    }

    async search(params: QdrantSearchParams): Promise<any[]> {
        const endpoint = `${this.url}/collections/${encodeURIComponent(params.collectionName)}/points/search`;
        const body: Record<string, any> = {
            vector: params.vector,
            limit: params.topK ?? 10,
            with_payload: params.withPayload ?? true,
            with_vector: params.withVector ?? false,
        };
        if (params.scoreThreshold !== undefined) {
            body.score_threshold = params.scoreThreshold;
        }
        if (params.filter) {
            body.filter = params.filter;
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Qdrant search failed (${response.status}): ${errText}`);
        }

        const data = await response.json();
        return data.result || [];
    }

    async upsertPoints(collectionName: string, points: QdrantPoint[], wait: boolean = true): Promise<any> {
        const endpoint = `${this.url}/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`;
        const response = await fetch(endpoint, {
            method: "PUT",
            headers: this.getHeaders(),
            body: JSON.stringify({ points }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Qdrant upsertPoints failed (${response.status}): ${errText}`);
        }

        return await response.json();
    }

    async deletePoints(collectionName: string, points: (string | number)[], wait: boolean = true): Promise<any> {
        const endpoint = `${this.url}/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait}`;
        const response = await fetch(endpoint, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ points }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Qdrant deletePoints failed (${response.status}): ${errText}`);
        }

        return await response.json();
    }

    async getCollectionInfo(collectionName: string): Promise<any> {
        const endpoint = `${this.url}/collections/${encodeURIComponent(collectionName)}`;
        const response = await fetch(endpoint, {
            method: "GET",
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Qdrant getCollectionInfo failed (${response.status}): ${errText}`);
        }

        const data = await response.json();
        return data.result;
    }
}

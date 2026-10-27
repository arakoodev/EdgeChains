import axios from "axios";

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
}

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
    collectionName: string;
    wordEmbeddings?: number[][];
    topK?: number;
    distance?: QdrantDistanceMetric;
    namespace?: string;
    filter?: Record<string, any>;
    scoreThreshold?: number;
}

export class QdrantClient {
    url: string;
    apiKey?: string;
    collectionName: string;
    wordEmbeddings: number[][];
    topK: number;
    distance: QdrantDistanceMetric;
    namespace?: string;
    filter?: Record<string, any>;
    scoreThreshold?: number;

    constructor(options: QdrantClientOptions) {
        this.url = (options.url || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/+$/, "");
        this.apiKey = options.apiKey || process.env.QDRANT_API_KEY;
        this.collectionName = options.collectionName;
        this.wordEmbeddings = options.wordEmbeddings || [];
        this.topK = options.topK || 10;
        this.distance = options.distance || QdrantDistanceMetric.COSINE;
        this.namespace = options.namespace;
        this.filter = options.filter;
        this.scoreThreshold = options.scoreThreshold;
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

    async createCollection(vectorSize: number, distance: QdrantDistanceMetric = this.distance): Promise<any> {
        const endpoint = `${this.url}/collections/${encodeURIComponent(this.collectionName)}`;
        const response = await axios.put(
            endpoint,
            {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            },
            { headers: this.getHeaders() }
        );
        return response.data;
    }

    async getCollection(): Promise<any> {
        const endpoint = `${this.url}/collections/${encodeURIComponent(this.collectionName)}`;
        const response = await axios.get(endpoint, { headers: this.getHeaders() });
        return response.data;
    }

    async deleteCollection(): Promise<any> {
        const endpoint = `${this.url}/collections/${encodeURIComponent(this.collectionName)}`;
        const response = await axios.delete(endpoint, { headers: this.getHeaders() });
        return response.data;
    }

    async upsertPoints(points: QdrantPoint[], wait: boolean = true): Promise<any> {
        const endpoint = `${this.url}/collections/${encodeURIComponent(this.collectionName)}/points?wait=${wait}`;
        const response = await axios.put(
            endpoint,
            { points },
            { headers: this.getHeaders() }
        );
        return response.data;
    }

    async searchPoints(
        vector: number[],
        limit: number = this.topK,
        filter?: Record<string, any>
    ): Promise<any[]> {
        const endpoint = `${this.url}/collections/${encodeURIComponent(this.collectionName)}/points/search`;
        const effectiveFilter =
            filter ||
            this.filter ||
            (this.namespace
                ? {
                      must: [
                          {
                              key: "namespace",
                              match: { value: this.namespace },
                          },
                      ],
                  }
                : undefined);

        const body: Record<string, any> = {
            vector,
            limit,
            with_payload: true,
        };
        if (effectiveFilter) {
            body.filter = effectiveFilter;
        }
        if (this.scoreThreshold !== undefined) {
            body.score_threshold = this.scoreThreshold;
        }

        const response = await axios.post(endpoint, body, { headers: this.getHeaders() });
        return response.data?.result || [];
    }

    async dbQuery(): Promise<any[]> {
        if (!this.wordEmbeddings || this.wordEmbeddings.length === 0) {
            return [];
        }

        const seenIds = new Set<string | number>();
        const mergedResults: any[] = [];

        for (const embedding of this.wordEmbeddings) {
            const hits = await this.searchPoints(embedding, this.topK);
            for (const hit of hits) {
                if (!seenIds.has(hit.id)) {
                    seenIds.add(hit.id);
                    mergedResults.push({
                        id: hit.id,
                        score: hit.score,
                        raw_text: hit.payload?.raw_text ?? "",
                        filename: hit.payload?.filename ?? "",
                        namespace: hit.payload?.namespace ?? this.namespace ?? "",
                        metadata: hit.payload?.metadata ?? hit.payload ?? {},
                    });
                }
            }
        }

        mergedResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        return mergedResults.slice(0, this.topK);
    }
}

import axios, { AxiosInstance } from "axios";

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
}

export interface QdrantClientOptions {
    wordEmbeddings: number[][];
    metric?: QdrantDistanceMetric;
    topK?: number;
    collectionName: string;
    namespace?: string;
    arkRequest?: any;
    upperLimit?: number;
    url?: string;
    apiKey?: string;
}

export class QdrantClient {
    wordEmbeddings: number[][];
    metric: QdrantDistanceMetric;
    topK: number;
    collectionName: string;
    namespace: string;
    arkRequest: any;
    upperLimit: number;
    url: string;
    apiKey?: string;

    constructor(
        wordEmbeddings: number[][],
        metric: QdrantDistanceMetric = QdrantDistanceMetric.COSINE,
        topK: number = 10,
        collectionName: string = "edgechains",
        namespace: string = "",
        arkRequest: any = {},
        upperLimit: number = 15,
        url?: string,
        apiKey?: string
    ) {
        this.wordEmbeddings = wordEmbeddings;
        this.metric = metric;
        this.topK = topK;
        this.collectionName = collectionName;
        this.namespace = namespace;
        this.arkRequest = arkRequest || {};
        this.upperLimit = upperLimit;
        this.url = (url || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/$/, "");
        this.apiKey = apiKey || process.env.QDRANT_API_KEY;
    }

    private getAxiosClient(): AxiosInstance {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }

        return axios.create({
            baseURL: this.url,
            headers,
            timeout: 30000,
        });
    }

    /**
     * Executes vector search queries across wordEmbeddings against Qdrant REST API
     * and performs Reciprocal Rank Fusion (RRF) ranking compatible with EdgeChains.
     */
    async dbQuery(): Promise<any[]> {
        const client = this.getAxiosClient();
        const allResults: any[] = [];

        for (let i = 0; i < this.wordEmbeddings.length; i++) {
            const embedding = this.wordEmbeddings[i];
            const searchBody: Record<string, any> = {
                vector: embedding,
                limit: this.topK,
                with_payload: true,
                with_vector: false,
            };

            if (this.namespace) {
                searchBody.filter = {
                    must: [
                        {
                            key: "namespace",
                            match: { value: this.namespace },
                        },
                    ],
                };
            }

            try {
                const response = await client.post(
                    `/collections/${this.collectionName}/points/search`,
                    searchBody
                );

                const hits = response.data?.result || [];

                hits.forEach((hit: any, rankIdx: number) => {
                    const baseWeight = this.arkRequest?.similarityWeight?.baseWeight ?? 1;
                    const fineTuneWeight =
                        this.arkRequest?.similarityWeight?.fineTuneWeight ?? 0.5;
                    const rrfScore = baseWeight / (rankIdx + 1 + fineTuneWeight);

                    allResults.push({
                        id: hit.id,
                        raw_text:
                            hit.payload?.raw_text ||
                            hit.payload?.content ||
                            hit.payload?.text ||
                            "",
                        score: hit.score,
                        similarity: hit.score,
                        rrf_score: rrfScore,
                        filename: hit.payload?.filename || "",
                        namespace: hit.payload?.namespace || this.namespace,
                        metadata: hit.payload?.metadata || hit.payload,
                        timestamp: hit.payload?.timestamp || new Date().toISOString(),
                    });
                });
            } catch (error: any) {
                console.error(
                    `QdrantClient query failed for collection ${this.collectionName}:`,
                    error?.response?.data || error?.message || error
                );
                throw error?.response?.data || error;
            }
        }

        // Deduplicate by id and sort by score / rrf_score
        const uniqueMap = new Map<string | number, any>();
        for (const item of allResults) {
            if (!uniqueMap.has(item.id)) {
                uniqueMap.set(item.id, item);
            } else {
                const existing = uniqueMap.get(item.id);
                // Accumulate RRF score for multi-query hits
                existing.rrf_score = (existing.rrf_score || 0) + (item.rrf_score || 0);
                if (item.score > existing.score) {
                    existing.score = item.score;
                    existing.similarity = item.similarity;
                }
            }
        }

        const sorted = Array.from(uniqueMap.values()).sort(
            (a, b) => (b.rrf_score || b.score) - (a.rrf_score || a.score)
        );

        const limit = this.wordEmbeddings.length > 1 ? this.upperLimit : this.topK;
        return sorted.slice(0, limit);
    }
}

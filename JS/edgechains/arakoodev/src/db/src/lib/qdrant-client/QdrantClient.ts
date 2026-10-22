import axios, { AxiosInstance } from "axios";

export class QdrantClient {
    wordEmbeddings: number[][];
    metric: QdrantDistanceMetric;
    topK: number;
    collectionName: string;
    namespace: string;
    arkRequest: any;
    upperLimit: number;
    host: string;
    port: number;
    apiKey?: string;
    httpClient: AxiosInstance;

    constructor(
        wordEmbeddings: number[][],
        metric: QdrantDistanceMetric,
        topK: number,
        collectionName: string,
        namespace: string,
        arkRequest: any,
        upperLimit: number,
        host: string = "localhost",
        port: number = 6333,
        apiKey?: string
    ) {
        this.wordEmbeddings = wordEmbeddings;
        this.metric = metric;
        this.topK = topK;
        this.collectionName = collectionName;
        this.namespace = namespace;
        this.arkRequest = arkRequest;
        this.upperLimit = upperLimit;
        this.host = host;
        this.port = port;
        this.apiKey = apiKey;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }

        this.httpClient = axios.create({
            baseURL: `http://${this.host}:${this.port}`,
            headers,
            timeout: 30000,
        });
    }

    private mapMetric(): string {
        switch (this.metric) {
            case QdrantDistanceMetric.COSINE:
                return "Cosine";
            case QdrantDistanceMetric.IP:
                return "Dot";
            case QdrantDistanceMetric.L2:
                return "Euclid";
            default:
                return "Cosine";
        }
    }

    async dbQuery() {
        try {
            const allResults: QdrantSearchResult[] = [];

            for (const embedding of this.wordEmbeddings) {
                const searchPayload = {
                    vector: embedding,
                    limit: this.topK,
                    with_payload: true,
                    with_vector: false,
                    filter: this.namespace
                        ? {
                              must: [
                                  {
                                      key: "namespace",
                                      match: { value: this.namespace },
                                  },
                              ],
                          }
                        : undefined,
                };

                const response = await this.httpClient.post<QdrantSearchResponse>(
                    `/collections/${this.collectionName}/points/search`,
                    searchPayload
                );

                if (response.data?.result) {
                    for (const hit of response.data.result) {
                        allResults.push({
                            id: hit.id,
                            score: hit.score,
                            raw_text: hit.payload?.raw_text ?? "",
                            document_date: hit.payload?.document_date ?? null,
                            metadata: hit.payload?.metadata ?? {},
                            namespace: hit.payload?.namespace ?? "",
                            filename: hit.payload?.filename ?? "",
                            timestamp: hit.payload?.timestamp ?? null,
                            rrf_score: this.computeRRFScore(hit),
                        });
                    }
                }
            }

            // Deduplicate by id, keeping highest score
            const seen = new Map<string | number, QdrantSearchResult>();
            for (const result of allResults) {
                const existing = seen.get(result.id);
                if (!existing || result.rrf_score > existing.rrf_score) {
                    seen.set(result.id, result);
                }
            }

            // Sort by order preference
            const sorted = Array.from(seen.values());
            this.sortResults(sorted);

            const limit = this.wordEmbeddings.length > 1 ? this.upperLimit : this.topK;
            return sorted.slice(0, limit);
        } catch (error: any) {
            throw new Error(
                `QdrantClient query failed: ${error.message || error}`
            );
        }
    }

    private computeRRFScore(hit: QdrantHit): number {
        const textWeight = this.arkRequest?.textWeight ?? {
            baseWeight: 1,
            fineTuneWeight: 60,
        };
        const similarityWeight = this.arkRequest?.similarityWeight ?? {
            baseWeight: 1,
            fineTuneWeight: 60,
        };
        const dateWeight = this.arkRequest?.dateWeight ?? {
            baseWeight: 1,
            fineTuneWeight: 60,
        };

        // Use similarity score directly from Qdrant
        const similarityScore = hit.score;

        // Compute date rank from document_date if available
        let dateRank = 0;
        if (hit.payload?.document_date) {
            const docDate = new Date(hit.payload.document_date);
            dateRank = docDate.getFullYear() * 365 + docDate.getMonth() * 30 + docDate.getDate();
        }

        // RRF scoring: weight / (rank + k)
        // Simplified version using Qdrant's native similarity score
        const rrfScore =
            similarityWeight.baseWeight / (1 / (similarityScore + 0.001) + similarityWeight.fineTuneWeight) +
            dateWeight.baseWeight / (dateRank > 0 ? dateRank + dateWeight.fineTuneWeight : 1);

        return rrfScore;
    }

    private sortResults(results: QdrantSearchResult[]) {
        const orderRRF = this.arkRequest?.orderRRF ?? "similarity";

        switch (orderRRF) {
            case "similarity":
                results.sort((a, b) => b.score - a.score);
                break;
            case "date_rank":
                results.sort((a, b) => {
                    const dateA = a.document_date ? new Date(a.document_date).getTime() : 0;
                    const dateB = b.document_date ? new Date(b.document_date).getTime() : 0;
                    return dateB - dateA || b.rrf_score - a.rrf_score;
                });
                break;
            case "text_rank":
            case "default":
            default:
                results.sort((a, b) => b.rrf_score - a.rrf_score);
                break;
        }
    }

    async createCollection(vectorSize: number): Promise<boolean> {
        try {
            const response = await this.httpClient.put(
                `/collections/${this.collectionName}`,
                {
                    vectors: {
                        size: vectorSize,
                        distance: this.mapMetric(),
                    },
                }
            );
            return response.status === 200;
        } catch (error: any) {
            throw new Error(
                `Failed to create collection: ${error.message || error}`
            );
        }
    }

    async upsertPoints(
        points: Array<{
            id: string | number;
            vector: number[];
            payload: Record<string, any>;
        }>
    ): Promise<boolean> {
        try {
            const response = await this.httpClient.put(
                `/collections/${this.collectionName}/points`,
                { points }
            );
            return response.status === 200;
        } catch (error: any) {
            throw new Error(
                `Failed to upsert points: ${error.message || error}`
            );
        }
    }

    async deletePoints(ids: (string | number)[]): Promise<boolean> {
        try {
            const response = await this.httpClient.post(
                `/collections/${this.collectionName}/points/delete`,
                { points: ids }
            );
            return response.status === 200;
        } catch (error: any) {
            throw new Error(
                `Failed to delete points: ${error.message || error}`
            );
        }
    }

    async getCollectionInfo(): Promise<QdrantCollectionInfo | null> {
        try {
            const response = await this.httpClient.get<QdrantCollectionResponse>(
                `/collections/${this.collectionName}`
            );
            return response.data?.result ?? null;
        } catch (error: any) {
            throw new Error(
                `Failed to get collection info: ${error.message || error}`
            );
        }
    }
}

export enum QdrantDistanceMetric {
    COSINE = "COSINE",
    IP = "IP",
    L2 = "L2",
}

interface QdrantHit {
    id: string | number;
    score: number;
    payload?: Record<string, any>;
}

interface QdrantSearchResponse {
    result: QdrantHit[];
    status: string;
    time: number;
}

interface QdrantSearchResult {
    id: string | number;
    score: number;
    raw_text: string;
    document_date: string | null;
    metadata: Record<string, any>;
    namespace: string;
    filename: string;
    timestamp: string | null;
    rrf_score: number;
}

interface QdrantCollectionInfo {
    status: string;
    vectors_count?: number;
    indexed_vectors_count?: number;
    points_count?: number;
    segments_count?: number;
    config?: {
        params?: {
            vectors?: {
                size?: number;
                distance?: string;
            };
        };
    };
}

interface QdrantCollectionResponse {
    result: QdrantCollectionInfo;
    status: string;
    time: number;
}

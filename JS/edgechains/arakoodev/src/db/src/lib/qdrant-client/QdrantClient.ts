import { Qdrant, QdrantDistanceMetric } from "../../../../vector-db/src/lib/qdrant/qdrant.js";

export interface ArkWeightOptions {
    baseWeight?: number;
    fineTuneWeight?: number;
}

export interface ArkRequestOptions {
    textWeight?: ArkWeightOptions;
    similarityWeight?: ArkWeightOptions;
    dateWeight?: ArkWeightOptions;
    orderRRF?: "text_rank" | "similarity" | "date_rank" | "default" | string;
    metadataTable?: string;
    query?: string;
    [key: string]: unknown;
}

export interface QdrantQueryResult {
    id: string | number;
    score: number;
    rrf_score: number;
    similarity: number;
    raw_text: string;
    filename: string;
    metadata: Record<string, unknown>;
    namespace: string;
    timestamp: string | null;
    document_date: string | null;
}

export class QdrantClient {
    wordEmbeddings: number[][];
    metric: QdrantDistanceMetric | string;
    topK: number;
    probes: number;
    tableName: string;
    namespace: string;
    arkRequest: ArkRequestOptions;
    upperLimit: number;
    url: string;
    apiKey: string;
    qdrant: Qdrant;

    constructor(
        wordEmbeddings: number[][],
        metric: QdrantDistanceMetric | string = QdrantDistanceMetric.COSINE,
        topK: number = 10,
        probes: number = 10,
        tableName: string = "documents",
        namespace: string = "",
        arkRequest: ArkRequestOptions = {},
        upperLimit: number = 15,
        url?: string,
        apiKey?: string
    ) {
        this.wordEmbeddings = wordEmbeddings;
        this.metric = metric;
        this.topK = topK;
        this.probes = probes;
        this.tableName = tableName;
        this.namespace = namespace;
        this.arkRequest = arkRequest;
        this.upperLimit = upperLimit;
        this.url = url || process.env.QDRANT_URL || "http://localhost:6333";
        this.apiKey = apiKey || process.env.QDRANT_API_KEY || "";
        this.qdrant = new Qdrant(this.url, this.apiKey);
    }

    async dbQuery(): Promise<QdrantQueryResult[]> {
        if (!this.wordEmbeddings || this.wordEmbeddings.length === 0) {
            return [];
        }

        const filter: Record<string, unknown> | undefined = this.namespace
            ? {
                  must: [
                      {
                          key: "namespace",
                          match: { value: this.namespace },
                      },
                  ],
              }
            : undefined;

        const allResults: QdrantQueryResult[] = [];

        for (const embedding of this.wordEmbeddings) {
            const hits = await this.qdrant.search(this.tableName, {
                vector: embedding,
                limit: this.topK,
                filter,
                with_payload: true,
                with_vector: false,
            });

            for (let rank = 0; rank < hits.length; rank++) {
                const hit = hits[rank];
                const id = (hit.id ?? "") as string | number;
                const score = typeof hit.score === "number" ? hit.score : 0;
                const payload =
                    hit.payload && typeof hit.payload === "object"
                        ? (hit.payload as Record<string, unknown>)
                        : {};

                let rrfScore = score;
                if (this.arkRequest?.similarityWeight) {
                    const baseWeight = this.arkRequest.similarityWeight.baseWeight ?? 1;
                    const fineTuneWeight = this.arkRequest.similarityWeight.fineTuneWeight ?? 0.5;
                    rrfScore = baseWeight / (rank + 1 + fineTuneWeight);
                }

                const rawText =
                    typeof payload.raw_text === "string"
                        ? payload.raw_text
                        : typeof payload.content === "string"
                          ? payload.content
                          : typeof payload.text === "string"
                            ? payload.text
                            : "";

                const filename =
                    typeof payload.filename === "string"
                        ? payload.filename
                        : typeof payload.document_name === "string"
                          ? payload.document_name
                          : "";

                const metadata =
                    payload.metadata && typeof payload.metadata === "object"
                        ? (payload.metadata as Record<string, unknown>)
                        : payload;

                const namespace =
                    typeof payload.namespace === "string" ? payload.namespace : this.namespace;

                const timestamp = typeof payload.timestamp === "string" ? payload.timestamp : null;

                const documentDate =
                    typeof payload.document_date === "string" ? payload.document_date : null;

                allResults.push({
                    id,
                    score,
                    rrf_score: rrfScore,
                    similarity: score,
                    raw_text: rawText,
                    filename,
                    metadata,
                    namespace,
                    timestamp,
                    document_date: documentDate,
                });
            }
        }

        // Deduplicate by ID, keeping the record with the highest rrf_score
        const uniqueMap = new Map<string | number, QdrantQueryResult>();
        for (const item of allResults) {
            const existing = uniqueMap.get(item.id);
            if (!existing || item.rrf_score > existing.rrf_score) {
                uniqueMap.set(item.id, item);
            }
        }

        const sortedResults = Array.from(uniqueMap.values()).sort(
            (a, b) => b.rrf_score - a.rrf_score
        );

        const limit = this.wordEmbeddings.length > 1 ? this.upperLimit : this.topK;
        return sortedResults.slice(0, limit);
    }
}

import axios, { AxiosInstance } from "axios";

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
    MANHATTAN = "Manhattan",
}

export interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, unknown>;
}

export interface QdrantFilterCondition {
    key: string;
    match?: { value: string | number | boolean };
    range?: { gt?: number; gte?: number; lt?: number; lte?: number };
}

export interface QdrantFilter {
    must?: QdrantFilterCondition[];
    should?: QdrantFilterCondition[];
    must_not?: QdrantFilterCondition[];
}

export interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
    timeoutMs?: number;
    wordEmbeddings?: number[][];
    metric?: QdrantDistanceMetric;
    topK?: number;
    collectionName?: string;
    namespace?: string;
    arkRequest?: Record<string, any>;
    upperLimit?: number;
}

export interface QdrantSearchHit {
    id: string | number;
    version?: number;
    score: number;
    payload?: Record<string, any>;
    vector?: number[];
}

export class Qdrant {
    readonly url: string;
    readonly apiKey?: string;
    private readonly http: AxiosInstance;

    constructor(url?: string, apiKey?: string, timeoutMs = 15000) {
        const rawUrl = url || process.env.QDRANT_URL || "http://localhost:6333";
        this.url = rawUrl.replace(/\/+$/, "");
        this.apiKey = apiKey || process.env.QDRANT_API_KEY;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }

        this.http = axios.create({
            baseURL: this.url,
            timeout: timeoutMs,
            headers,
        });
    }

    /**
     * Create or recreate a Qdrant collection via PUT /collections/{collection_name}
     */
    async createCollection({
        collectionName,
        vectorSize,
        distance = QdrantDistanceMetric.COSINE,
        onDiskPayload = false,
    }: {
        collectionName: string;
        vectorSize: number;
        distance?: QdrantDistanceMetric;
        onDiskPayload?: boolean;
    }): Promise<any> {
        const res = await this.http.put(`/collections/${encodeURIComponent(collectionName)}`, {
            vectors: {
                size: vectorSize,
                distance,
            },
            on_disk_payload: onDiskPayload,
        });
        return res.data;
    }

    /**
     * Retrieve collection metadata via GET /collections/{collection_name}
     */
    async getCollection({ collectionName }: { collectionName: string }): Promise<any> {
        const res = await this.http.get(`/collections/${encodeURIComponent(collectionName)}`);
        return res.data;
    }

    /**
     * Delete a collection via DELETE /collections/{collection_name}
     */
    async deleteCollection({ collectionName }: { collectionName: string }): Promise<any> {
        const res = await this.http.delete(`/collections/${encodeURIComponent(collectionName)}`);
        return res.data;
    }

    /**
     * Upsert points into a Qdrant collection via PUT /collections/{collection_name}/points
     */
    async upsertPoints({
        collectionName,
        points,
        wait = true,
    }: {
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        const res = await this.http.put(
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait ? "true" : "false"}`,
            { points }
        );
        return res.data;
    }

    /**
     * EdgeChains Supabase-compatible helper to insert a single vector point
     */
    async insertVectorData({
        collectionName,
        id,
        embedding,
        payload = {},
        wait = true,
    }: {
        collectionName: string;
        id: string | number;
        embedding: number[];
        payload?: Record<string, unknown>;
        wait?: boolean;
    }): Promise<any> {
        return this.upsertPoints({
            collectionName,
            points: [{ id, vector: embedding, payload }],
            wait,
        });
    }

    /**
     * Search nearest vectors via POST /collections/{collection_name}/points/search
     */
    async searchPoints({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: {
        collectionName: string;
        vector: number[];
        limit?: number;
        filter?: QdrantFilter;
        withPayload?: boolean;
        withVector?: boolean;
        scoreThreshold?: number;
    }): Promise<QdrantSearchHit[]> {
        const body: Record<string, unknown> = {
            vector,
            limit,
            with_payload: withPayload,
            with_vector: withVector,
        };
        if (filter) body.filter = filter;
        if (typeof scoreThreshold === "number") body.score_threshold = scoreThreshold;

        const res = await this.http.post(
            `/collections/${encodeURIComponent(collectionName)}/points/search`,
            body
        );
        return res.data?.result ?? [];
    }

    /**
     * Retrieve points by IDs via POST /collections/{collection_name}/points
     */
    async getDataByIds({
        collectionName,
        ids,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        ids: Array<string | number>;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any[]> {
        const res = await this.http.post(
            `/collections/${encodeURIComponent(collectionName)}/points`,
            {
                ids,
                with_payload: withPayload,
                with_vector: withVector,
            }
        );
        return res.data?.result ?? [];
    }

    /**
     * Delete points by IDs or filter via POST /collections/{collection_name}/points/delete
     */
    async deleteByIds({
        collectionName,
        ids,
        filter,
        wait = true,
    }: {
        collectionName: string;
        ids?: Array<string | number>;
        filter?: QdrantFilter;
        wait?: boolean;
    }): Promise<any> {
        const body: Record<string, unknown> = {};
        if (ids && ids.length > 0) body.points = ids;
        if (filter) body.filter = filter;

        const res = await this.http.post(
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait ? "true" : "false"}`,
            body
        );
        return res.data;
    }
}

/**
 * QdrantClient wraps the direct Qdrant REST client with the same multi-embedding
 * Reciprocal Rank Fusion (RRF) query interface used by PostgresClient in HydeSearchService.
 */
export class QdrantClient extends Qdrant {
    wordEmbeddings: number[][];
    metric: QdrantDistanceMetric;
    topK: number;
    collectionName: string;
    namespace: string;
    arkRequest: Record<string, any>;
    upperLimit: number;

    constructor(
        wordEmbeddings: number[][] = [],
        metric: QdrantDistanceMetric = QdrantDistanceMetric.COSINE,
        topK = 5,
        collectionName = "ada_hyde_prod",
        namespace = "360_docs",
        arkRequest: Record<string, any> = {},
        upperLimit = 15,
        url?: string,
        apiKey?: string
    ) {
        super(url, apiKey);
        this.wordEmbeddings = wordEmbeddings;
        this.metric = metric;
        this.topK = topK;
        this.collectionName = collectionName;
        this.namespace = namespace;
        this.arkRequest = arkRequest;
        this.upperLimit = upperLimit;
    }

    /**
     * Executes vector similarity search across all wordEmbeddings against Qdrant,
     * deduplicates results by point ID, and ranks via Reciprocal Rank Fusion (RRF).
     */
    async dbQuery(): Promise<
        Array<{
            id: string | number;
            raw_text: string;
            score: number;
            rrf_score: number;
            filename?: string;
            namespace?: string;
            document_date?: string;
            metadata?: Record<string, unknown>;
        }>
    > {
        const filter: QdrantFilter | undefined = this.namespace
            ? {
                  must: [
                      {
                          key: "namespace",
                          match: { value: this.namespace },
                      },
                  ],
              }
            : undefined;

        const simBase = Number(this.arkRequest?.similarityWeight?.baseWeight ?? 1.0);
        const simFineTune = Number(this.arkRequest?.similarityWeight?.fineTuneWeight ?? 60);

        const aggregated = new Map<
            string | number,
            {
                id: string | number;
                raw_text: string;
                score: number;
                rrf_score: number;
                filename?: string;
                namespace?: string;
                document_date?: string;
                metadata?: Record<string, unknown>;
            }
        >();

        for (const embedding of this.wordEmbeddings) {
            const hits = await this.searchPoints({
                collectionName: this.collectionName,
                vector: embedding,
                limit: this.topK,
                filter,
                withPayload: true,
            });

            hits.forEach((hit, index) => {
                const rank = index + 1;
                const rrfContribution = simBase / (rank + simFineTune);
                const payload = hit.payload || {};
                const existing = aggregated.get(hit.id);

                if (existing) {
                    existing.rrf_score += rrfContribution;
                    if (hit.score > existing.score) {
                        existing.score = hit.score;
                    }
                } else {
                    aggregated.set(hit.id, {
                        id: hit.id,
                        raw_text: String(payload.raw_text ?? payload.content ?? ""),
                        score: hit.score,
                        rrf_score: rrfContribution,
                        filename: payload.filename ? String(payload.filename) : undefined,
                        namespace: payload.namespace ? String(payload.namespace) : this.namespace,
                        document_date: payload.document_date
                            ? String(payload.document_date)
                            : undefined,
                        metadata:
                            payload.metadata && typeof payload.metadata === "object"
                                ? (payload.metadata as Record<string, unknown>)
                                : undefined,
                    });
                }
            });
        }

        const limit = this.wordEmbeddings.length > 1 ? this.upperLimit : this.topK;
        return Array.from(aggregated.values())
            .sort((a, b) => b.rrf_score - a.rrf_score || b.score - a.score)
            .slice(0, limit);
    }
}

import { Qdrant, QdrantDistanceMetric, QdrantSearchHit } from "./qdrant.js";

/**
 * HydeSearch / PostgresClient-shaped Qdrant search client.
 *
 * Constructor arguments match {@link PostgresClient} so HydeSearchService can
 * swap databases with a one-line change:
 *
 * ```
 * const dbClient = new QdrantClient(
 *     embeddings, QdrantDistanceMetric.IP, topK, 20, table, namespace, arkRequest, 15
 * );
 * const queryResult = await dbClient.dbQuery();
 * ```
 *
 * `probes` is mapped to Qdrant `hnsw_ef`. `tableName` is the collection name.
 * `namespace` is applied as a payload must-filter. URL and API key are read
 * from `QDRANT_URL` / `QDRANT_API_KEY` unless passed explicitly.
 */
export class QdrantClient {
    wordEmbeddings: number[][];
    metric: QdrantDistanceMetric | string;
    topK: number;
    probes: number;
    tableName: string;
    namespace: string;
    arkRequest: any;
    upperLimit: number;
    private qdrant: Qdrant;

    constructor(
        wordEmbeddings: number[][],
        metric: QdrantDistanceMetric | string,
        topK: number,
        probes: number,
        tableName: string,
        namespace: string,
        arkRequest: any,
        upperLimit: number,
        qdrantUrl?: string,
        qdrantApiKey?: string
    ) {
        this.wordEmbeddings = wordEmbeddings;
        this.metric = metric;
        this.topK = topK;
        this.probes = probes;
        this.tableName = tableName;
        this.namespace = namespace;
        this.arkRequest = arkRequest;
        this.upperLimit = upperLimit;
        this.qdrant = new Qdrant(qdrantUrl, qdrantApiKey);
    }

    async dbQuery(): Promise<Array<Record<string, any>>> {
        const rrfK = 60;
        const merged = new Map<
            string,
            {
                hit: QdrantSearchHit;
                rrf_score: number;
                similarity: number;
                text_rank: number;
                date_rank: number;
            }
        >();

        for (const embedding of this.wordEmbeddings) {
            const hits = await this.qdrant.search({
                collectionName: this.tableName,
                vector: embedding,
                limit: this.topK,
                filter: this.namespace
                    ? { must: [{ key: "namespace", match: { value: this.namespace } }] }
                    : undefined,
                params: this.probes ? { hnsw_ef: this.probes } : undefined,
                withPayload: true,
            });

            hits.forEach((hit, rank) => {
                const key = String(hit.id);
                const payload = hit.payload || {};
                const existing = merged.get(key);
                const rrf = 1 / (rrfK + rank + 1);
                const dateRank = this.toDateRank(payload.document_date);
                const textRank = this.toTextRank(payload, this.arkRequest?.query);

                if (existing) {
                    existing.rrf_score += rrf;
                    existing.similarity = Math.max(existing.similarity, hit.score);
                    existing.text_rank = Math.max(existing.text_rank, textRank);
                    existing.date_rank = Math.max(existing.date_rank, dateRank);
                } else {
                    merged.set(key, {
                        hit,
                        rrf_score: rrf,
                        similarity: hit.score,
                        text_rank: textRank,
                        date_rank: dateRank,
                    });
                }
            });
        }

        const rows = Array.from(merged.values()).map((entry) => {
            const payload = entry.hit.payload || {};
            const rawText = payload.raw_text || payload.content || "";
            return {
                id: entry.hit.id,
                raw_text: rawText,
                content: rawText,
                document_date: payload.document_date ?? null,
                metadata: payload.metadata ?? null,
                namespace: payload.namespace ?? this.namespace,
                filename: payload.filename ?? null,
                timestamp: payload.timestamp ?? null,
                similarity: entry.similarity,
                text_rank: entry.text_rank,
                date_rank: entry.date_rank,
                rrf_score: entry.rrf_score,
                score: entry.rrf_score,
            };
        });

        const order = this.arkRequest?.orderRRF || "default";
        rows.sort((a, b) => {
            switch (order) {
                case "text_rank":
                    return b.text_rank - a.text_rank || b.rrf_score - a.rrf_score;
                case "similarity":
                    return b.similarity - a.similarity || b.rrf_score - a.rrf_score;
                case "date_rank":
                    return b.date_rank - a.date_rank || b.rrf_score - a.rrf_score;
                default:
                    return b.rrf_score - a.rrf_score;
            }
        });

        const limit = this.wordEmbeddings.length > 1 ? this.upperLimit : this.topK;
        return rows.slice(0, limit);
    }

    private toDateRank(documentDate: any): number {
        if (!documentDate) {
            return 0;
        }
        const date = documentDate instanceof Date ? documentDate : new Date(documentDate);
        if (Number.isNaN(date.getTime())) {
            return 0;
        }
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date.getTime() - start.getTime();
        const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
        return date.getFullYear() * 365 + dayOfYear;
    }

    private toTextRank(payload: Record<string, any>, query?: string): number {
        if (!query) {
            return 0;
        }
        const haystack = String(payload.raw_text || payload.content || "").toLowerCase();
        if (!haystack) {
            return 0;
        }
        const tokens = String(query).toLowerCase().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) {
            return 0;
        }
        const hits = tokens.filter((token) => haystack.includes(token)).length;
        return hits / tokens.length;
    }
}

export { QdrantDistanceMetric };

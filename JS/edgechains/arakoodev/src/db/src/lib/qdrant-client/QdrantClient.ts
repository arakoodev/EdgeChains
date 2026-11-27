import { QdrantClient as QdrantRestClient } from "@qdrant/js-client-rest";

/**
 * QdrantClient mirrors PostgresClient's hybrid retrieval contract
 * (vector similarity + full-text match + document date, combined with a
 * weighted reciprocal-rank-fusion score) on top of a Qdrant collection
 * instead of Postgres/pgvector.
 *
 * Expected point payload shape (same fields PostgresClient selects):
 *   raw_text, namespace, filename, timestamp, document_date, metadata
 *
 * Connection settings are read from the environment (dotenv-compatible):
 *   QDRANT_URL   e.g. http://localhost:6333 or https://<cluster>.qdrant.io
 *   QDRANT_API_KEY  (optional, for Qdrant Cloud)
 * They can be overridden with the optional `connection` constructor arg.
 *
 * The `probes` argument maps to Qdrant's `hnsw_ef` search-time parameter.
 */
export class QdrantClient {
    wordEmbeddings: number[][];
    metric: QdrantDistanceMetric;
    topK: number;
    probes: number;
    collectionName: string;
    namespace: string;
    arkRequest: any;
    upperLimit: number;
    client: QdrantRestClient;

    constructor(
        wordEmbeddings: number[][],
        metric: QdrantDistanceMetric,
        topK: number,
        probes: number,
        collectionName: string,
        namespace: string,
        arkRequest: any,
        upperLimit: number,
        connection?: { url?: string; apiKey?: string }
    ) {
        this.wordEmbeddings = wordEmbeddings;
        this.metric = metric;
        this.topK = topK;
        this.probes = probes;
        this.collectionName = collectionName;
        this.namespace = namespace;
        this.arkRequest = arkRequest;
        this.upperLimit = upperLimit;
        this.client = new QdrantRestClient({
            url: connection?.url ?? process.env.QDRANT_URL ?? "http://localhost:6333",
            apiKey: connection?.apiKey ?? process.env.QDRANT_API_KEY,
        });
    }

    /**
     * Returns Qdrant's distance constant for this metric. The collection's
     * vectors must have been created with the matching distance.
     */
    distance(): "Cosine" | "Dot" | "Euclid" {
        switch (this.metric) {
            case QdrantDistanceMetric.COSINE:
                return "Cosine";
            case QdrantDistanceMetric.IP:
                return "Dot";
            case QdrantDistanceMetric.L2:
                return "Euclid";
        }
    }

    /**
     * Runs the hybrid query and returns rows shaped like PostgresClient's
     * result: { id, raw_text, document_date, metadata, namespace, filename,
     * timestamp, rrf_score } sorted by rrf_score DESC.
     *
     * Like the Postgres implementation, three ranked candidate lists are
     * produced per embedding (vector similarity, full-text match, document
     * date) and fused with
     *   weight.baseWeight / (rank + weight.fineTuneWeight)
     * summed across the lists, using 1-based ranks. Results from multiple
     * embeddings are unioned, deduplicated by id and capped at upperLimit.
     *
     * Note: Qdrant has no ts_rank_cd equivalent, so the text list is ordered
     * by Qdrant's own full-text match ordering; the RRF math is identical.
     */
    async dbQuery() {
        const namespaceFilter = {
            must: [{ key: "namespace", match: { value: this.namespace } }],
        };
        const textFilter = {
            must: [
                { key: "namespace", match: { value: this.namespace } },
                { key: "raw_text", match: { text: this.arkRequest.query } },
            ],
        };

        // id -> fused row
        const fused = new Map<string | number, any>();

        for (let i = 0; i < this.wordEmbeddings.length; i++) {
            const embedding = this.wordEmbeddings[i];

            // 1. vector similarity ranking
            const vectorHits = (
                await this.client.query(this.collectionName, {
                    query: embedding,
                    limit: this.topK,
                    filter: namespaceFilter,
                    params: { hnsw_ef: this.probes },
                    with_payload: true,
                })
            ).points;

            // 2. full-text ranking over raw_text
            const textHits = await this.client.scroll(this.collectionName, {
                filter: textFilter,
                limit: this.topK,
                with_payload: true,
                with_vector: false,
            });

            // 3. document date ranking (most recent first)
            const dateHits = await this.client.scroll(this.collectionName, {
                filter: namespaceFilter,
                limit: this.topK,
                order_by: { key: "document_date", direction: "desc" },
                with_payload: true,
                with_vector: false,
            });

            const lists = [
                { hits: vectorHits.map((h) => h.id), weight: this.arkRequest.similarityWeight },
                { hits: textHits.points.map((p) => p.id), weight: this.arkRequest.textWeight },
                { hits: dateHits.points.map((p) => p.id), weight: this.arkRequest.dateWeight },
            ];

            const payloads = new Map<string | number, any>();
            const mergePayload = (id: string | number, payload: any) =>
                payloads.set(id, { ...payloads.get(id), ...payload });
            for (const h of vectorHits) mergePayload(h.id, h.payload);
            for (const p of textHits.points) mergePayload(p.id, p.payload);
            for (const p of dateHits.points) mergePayload(p.id, p.payload);

            const scores = new Map<string | number, number>();
            for (const list of lists) {
                list.hits.forEach((id, idx) => {
                    const rank = idx + 1; // ROW_NUMBER() is 1-based
                    const contribution =
                        list.weight.baseWeight / (rank + list.weight.fineTuneWeight);
                    scores.set(id, (scores.get(id) ?? 0) + contribution);
                });
            }

            for (const [id, score] of scores) {
                const payload: any = payloads.get(id) ?? {};
                const existing = fused.get(id);
                // keep the highest score seen across embeddings (dedupe)
                if (!existing || score > existing.rrf_score) {
                    fused.set(id, {
                        id,
                        raw_text: payload.raw_text ?? null,
                        document_date: payload.document_date ?? null,
                        metadata: payload.metadata ?? null,
                        namespace: payload.namespace ?? null,
                        filename: payload.filename ?? null,
                        timestamp: payload.timestamp ?? null,
                        rrf_score: score,
                    });
                }
            }
        }

        const limit =
            this.wordEmbeddings.length > 1 ? this.upperLimit : this.topK;
        return [...fused.values()]
            .sort((a, b) => b.rrf_score - a.rrf_score)
            .slice(0, limit);
    }
}

export enum QdrantDistanceMetric {
    COSINE = "COSINE",
    IP = "IP",
    L2 = "L2",
}

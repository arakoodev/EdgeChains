import { Qdrant, QdrantDistanceMetric } from "../../../../vector-db/src/lib/qdrant/qdrant.js";

export { QdrantDistanceMetric };

export interface ArkRequestWeight {
    baseWeight: number;
    fineTuneWeight: number;
}

export interface QdrantArkRequest {
    query?: string;
    textWeight?: ArkRequestWeight;
    similarityWeight?: ArkRequestWeight;
    dateWeight?: ArkRequestWeight;
    orderRRF?: "text_rank" | "similarity" | "date_rank" | "default" | string;
    metadataTable?: string;
    [key: string]: any;
}

export class QdrantClient {
    wordEmbeddings: number[][];
    metric: QdrantDistanceMetric;
    topK: number;
    collectionName: string;
    qdrantUrl: string;
    apiKey?: string;
    arkRequest: any;
    upperLimit: number;
    qdrant: Qdrant;

    constructor(
        wordEmbeddings: number[][],
        metric: QdrantDistanceMetric,
        topK: number,
        collectionName: string,
        qdrantUrl: string,
        apiKey?: string,
        arkRequest?: any,
        upperLimit?: number
    ) {
        this.wordEmbeddings = wordEmbeddings || [];
        this.metric = metric;
        this.topK = topK;
        this.collectionName = collectionName;
        this.qdrantUrl = qdrantUrl;
        this.apiKey = apiKey;
        this.arkRequest = arkRequest || {};
        this.upperLimit = upperLimit !== undefined ? upperLimit : topK;
        this.qdrant = new Qdrant(this.qdrantUrl, this.apiKey);
    }

    private computeTextScore(text: string, query?: string): number {
        if (!text || !query) return 0;
        const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (queryTerms.length === 0) return 0;
        const lowerText = text.toLowerCase();
        let matches = 0;
        for (const term of queryTerms) {
            let pos = 0;
            while ((pos = lowerText.indexOf(term, pos)) !== -1) {
                matches++;
                pos += term.length;
            }
        }
        return matches;
    }

    private computeDateScore(dateVal: any): number {
        if (!dateVal) return 0;
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return 0;
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const dayOfYear =
            Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        return d.getFullYear() * 365 + dayOfYear;
    }

    async dbQuery(): Promise<any[]> {
        if (!this.wordEmbeddings || this.wordEmbeddings.length === 0) {
            return [];
        }

        const textBaseWeight = this.arkRequest?.textWeight?.baseWeight ?? 1;
        const textFineTuneWeight = this.arkRequest?.textWeight?.fineTuneWeight ?? 0.5;

        const similarityBaseWeight = this.arkRequest?.similarityWeight?.baseWeight ?? 1;
        const similarityFineTuneWeight = this.arkRequest?.similarityWeight?.fineTuneWeight ?? 0.5;

        const dateBaseWeight = this.arkRequest?.dateWeight?.baseWeight ?? 1;
        const dateFineTuneWeight = this.arkRequest?.dateWeight?.fineTuneWeight ?? 0.5;

        const allResults: any[] = [];

        for (let i = 0; i < this.wordEmbeddings.length; i++) {
            const embedding = this.wordEmbeddings[i];
            const searchResponse = await this.qdrant.getDataFromQuery({
                collectionName: this.collectionName,
                vector: embedding,
                limit: this.topK,
                withPayload: true,
            });

            const points: any[] = Array.isArray(searchResponse)
                ? searchResponse
                : searchResponse?.result || [];

            if (points.length === 0) {
                continue;
            }

            // Map each point to standard fields
            const items = points.map((point) => {
                const payload = point.payload || {};
                const rawText = payload.raw_text ?? payload.content ?? payload.text ?? "";
                const similarity = typeof point.score === "number" ? point.score : 0;
                const textScore =
                    typeof payload.text_rank === "number"
                        ? payload.text_rank
                        : this.computeTextScore(rawText, this.arkRequest?.query);
                const dateScore =
                    typeof payload.date_rank === "number"
                        ? payload.date_rank
                        : this.computeDateScore(payload.document_date || payload.timestamp);

                return {
                    id: point.id,
                    raw_text: rawText,
                    document_date: payload.document_date,
                    metadata: payload.metadata,
                    namespace: payload.namespace,
                    filename: payload.filename,
                    timestamp: payload.timestamp,
                    similarity,
                    text_rank: textScore,
                    date_rank: dateScore,
                    score: point.score ?? similarity,
                    payload,
                    ...payload,
                };
            });

            // Calculate ranks for RRF (1-indexed)
            // Sort copy by similarity DESC to get similarity ranks
            const sortedBySim = [...items].sort((a, b) => b.similarity - a.similarity);
            const simRankMap = new Map<any, number>();
            sortedBySim.forEach((item, idx) => simRankMap.set(item.id, idx + 1));

            // Sort copy by text_rank DESC to get text ranks
            const sortedByText = [...items].sort((a, b) => b.text_rank - a.text_rank);
            const textRankMap = new Map<any, number>();
            sortedByText.forEach((item, idx) => textRankMap.set(item.id, idx + 1));

            // Sort copy by date_rank DESC to get date ranks
            const sortedByDate = [...items].sort((a, b) => b.date_rank - a.date_rank);
            const dateRankMap = new Map<any, number>();
            sortedByDate.forEach((item, idx) => dateRankMap.set(item.id, idx + 1));

            // Compute RRF score for each item
            for (const item of items) {
                const simRank = simRankMap.get(item.id) || items.length;
                const textRank = textRankMap.get(item.id) || items.length;
                const dateRank = dateRankMap.get(item.id) || items.length;

                item.rrf_score =
                    textBaseWeight / (textRank + textFineTuneWeight) +
                    similarityBaseWeight / (simRank + similarityFineTuneWeight) +
                    dateBaseWeight / (dateRank + dateFineTuneWeight);
            }

            this.sortResults(items);
            allResults.push(...items.slice(0, this.topK));
        }

        // Deduplication and final ordering
        if (this.wordEmbeddings.length > 1) {
            const seen = new Map<string | number, any>();
            for (const item of allResults) {
                if (!seen.has(item.id) || seen.get(item.id).rrf_score < item.rrf_score) {
                    seen.set(item.id, item);
                }
            }
            const deduplicated = Array.from(seen.values());
            return this.sortResults(deduplicated).slice(0, this.upperLimit);
        } else {
            return this.sortResults(allResults).slice(0, this.topK);
        }
    }

    private sortResults(items: any[]): any[] {
        switch (this.arkRequest?.orderRRF) {
            case "text_rank":
                return items.sort((a, b) => b.text_rank - a.text_rank || b.rrf_score - a.rrf_score);
            case "similarity":
                return items.sort(
                    (a, b) => b.similarity - a.similarity || b.rrf_score - a.rrf_score
                );
            case "date_rank":
                return items.sort((a, b) => b.date_rank - a.date_rank || b.rrf_score - a.rrf_score);
            case "default":
            default:
                return items.sort((a, b) => b.rrf_score - a.rrf_score);
        }
    }
}

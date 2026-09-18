export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    DOT = "Dot",
    EUCLID = "Euclid",
    MANHATTAN = "Manhattan",
}

export type QdrantClientOptions = {
    url: string;
    apiKey?: string;
    collectionName: string;
    vectorName?: string;
    namespace?: string;
    topK?: number;
    withPayload?: boolean;
    withVector?: boolean;
};

export type QdrantPoint = {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, unknown>;
};

type QdrantSearchResult = {
    id: string | number;
    score: number;
    payload?: Record<string, unknown>;
    vector?: number[] | Record<string, number[]>;
};

export class QdrantClient {
    private readonly url: string;
    private readonly apiKey?: string;
    private readonly collectionName: string;
    private readonly vectorName?: string;
    private readonly namespace?: string;
    private readonly topK: number;
    private readonly withPayload: boolean;
    private readonly withVector: boolean;

    constructor(options: QdrantClientOptions) {
        if (!options.url) {
            throw new Error("Qdrant url is required");
        }
        if (!options.collectionName) {
            throw new Error("Qdrant collectionName is required");
        }

        this.url = options.url.replace(/\/$/, "");
        this.apiKey = options.apiKey;
        this.collectionName = options.collectionName;
        this.vectorName = options.vectorName;
        this.namespace = options.namespace;
        this.topK = options.topK ?? 10;
        this.withPayload = options.withPayload ?? true;
        this.withVector = options.withVector ?? false;
    }

    async upsertPoints(points: QdrantPoint[], wait = true): Promise<unknown> {
        return this.request(
            `/collections/${encodeURIComponent(this.collectionName)}/points?wait=${wait}`,
            {
                method: "PUT",
                body: JSON.stringify({ points }),
            }
        );
    }

    async search(vector: number[], topK = this.topK, filter?: Record<string, unknown>): Promise<QdrantSearchResult[]> {
        const body: Record<string, unknown> = {
            vector: this.vectorName ? { name: this.vectorName, vector } : vector,
            limit: topK,
            with_payload: this.withPayload,
            with_vector: this.withVector,
        };

        const combinedFilter = this.buildFilter(filter);
        if (combinedFilter) {
            body.filter = combinedFilter;
        }

        const response = await this.request(
            `/collections/${encodeURIComponent(this.collectionName)}/points/search`,
            {
                method: "POST",
                body: JSON.stringify(body),
            }
        );

        return ((response as { result?: QdrantSearchResult[] }).result ?? []).map((result) => ({
            ...result,
            raw_text: result.payload?.raw_text ?? result.payload?.text,
            metadata: result.payload?.metadata ?? result.payload,
            namespace: result.payload?.namespace,
        })) as QdrantSearchResult[];
    }

    async dbQuery(wordEmbeddings: number[][]): Promise<QdrantSearchResult[]> {
        const searches = await Promise.all(
            wordEmbeddings.map((embedding) => this.search(embedding, this.topK))
        );

        const byId = new Map<string | number, QdrantSearchResult>();
        searches.flat().forEach((result) => {
            const previous = byId.get(result.id);
            if (!previous || result.score > previous.score) {
                byId.set(result.id, result);
            }
        });

        return Array.from(byId.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, this.topK);
    }

    private buildFilter(filter?: Record<string, unknown>): Record<string, unknown> | undefined {
        const must: unknown[] = [];
        if (this.namespace) {
            must.push({ key: "namespace", match: { value: this.namespace } });
        }
        if (filter?.must && Array.isArray(filter.must)) {
            must.push(...filter.must);
        }
        return must.length ? { ...filter, must } : filter;
    }

    private async request(path: string, init: RequestInit): Promise<unknown> {
        const response = await fetch(`${this.url}${path}`, {
            ...init,
            headers: {
                "content-type": "application/json",
                ...(this.apiKey ? { "api-key": this.apiKey } : {}),
                ...(init.headers ?? {}),
            },
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Qdrant request failed (${response.status}): ${body}`);
        }

        return response.json();
    }
}

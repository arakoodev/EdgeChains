export interface QdrantConfig {
    qdrantApiUrl: string;
    qdrantApiKey?: string;
}

export interface CreateCollectionArgs {
    collectionName: string;
    vectorSize?: number;
    distance?: "Cosine" | "Euclid" | "Dot";
}

export interface InsertVectorArgs {
    collectionName: string;
    points: { id: number | string; vector: number[]; payload?: Record<string, any> }[];
}

export interface SearchVectorArgs {
    collectionName: string;
    queryVector: number[];
    top: number;
    filter?: Record<string, any>;
}

export class QdrantClient {
    private baseUrl: string;
    private apiKey?: string;

    constructor(config: QdrantConfig) {
        this.baseUrl = config.qdrantApiUrl.replace(/\/+$/, "");
        this.apiKey = config.qdrantApiKey;
    }

    private headers(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            ...(this.apiKey ? { "api-key": this.apiKey } : {}),
        };
    }

    async createCollection({ collectionName, vectorSize = 1536, distance = "Cosine" }: CreateCollectionArgs) {
        const res = await fetch(`${this.baseUrl}/collections/${encodeURIComponent(collectionName)}`, {
            method: "PUT",
            headers: this.headers(),
            body: JSON.stringify({ vectors: { size: vectorSize, distance } }),
        });
        if (!res.ok) throw new Error(`Failed to create Qdrant collection: ${await res.text()}`);
        return res.json();
    }

    async upsertPoints({ collectionName, points }: InsertVectorArgs) {
        const res = await fetch(`${this.baseUrl}/collections/${encodeURIComponent(collectionName)}/points?wait=true`, {
            method: "PUT",
            headers: this.headers(),
            body: JSON.stringify({ points }),
        });
        if (!res.ok) throw new Error(`Failed to upsert Qdrant points: ${await res.text()}`);
        return res.json();
    }

    async search({ collectionName, queryVector, top, filter }: SearchVectorArgs) {
        const res = await fetch(`${this.baseUrl}/collections/${encodeURIComponent(collectionName)}/points/search`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ vector: queryVector, limit: top, ...(filter ? { filter } : {}), with_payload: true }),
        });
        if (!res.ok) throw new Error(`Failed to search Qdrant points: ${await res.text()}`);
        const data = await res.json();
        return data.result;
    }

    async deletePoints(collectionName: string, points: (number | string)[]) {
        const res = await fetch(`${this.baseUrl}/collections/${encodeURIComponent(collectionName)}/points/delete?wait=true`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ points }),
        });
        if (!res.ok) throw new Error(`Failed to delete Qdrant points: ${await res.text()}`);
        return res.json();
    }
}

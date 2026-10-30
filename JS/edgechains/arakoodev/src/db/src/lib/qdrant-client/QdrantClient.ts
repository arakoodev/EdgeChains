import axios from "axios";

interface QdrantConstructionOptions {
    url?: string;
    apiKey?: string;
    collectionName?: string;
}

interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export class QdrantClient {
    url: string;
    apiKey: string;
    collectionName: string;

    constructor(options: QdrantConstructionOptions) {
        this.url = options.url || process.env.QDRANT_URL || "http://localhost:6333";
        this.apiKey = options.apiKey || process.env.QDRANT_API_KEY || "";
        this.collectionName = options.collectionName || "default";
    }

    private headers(): Record<string, string> {
        const h: Record<string, string> = { "Content-Type": "application/json" };
        if (this.apiKey) h["api-key"] = this.apiKey;
        return h;
    }

    async createCollection(vectorSize: number, distance: string = "Cosine"): Promise<any> {
        const response = await axios.put(
            `${this.url}/collections/${this.collectionName}`,
            { vectors: { size: vectorSize, distance } },
            { headers: this.headers() }
        );
        return response.data;
    }

    async upsert(points: QdrantPoint[]): Promise<any> {
        const response = await axios.put(
            `${this.url}/collections/${this.collectionName}/points`,
            { points },
            { headers: this.headers() }
        );
        return response.data;
    }

    async search(vector: number[], limit: number = 10, filter?: Record<string, any>): Promise<any> {
        const body: any = { vector, limit, with_payload: true };
        if (filter) body.filter = filter;
        const response = await axios.post(
            `${this.url}/collections/${this.collectionName}/points/search`,
            body,
            { headers: this.headers() }
        );
        return response.data.result;
    }

    async delete(ids: (string | number)[]): Promise<any> {
        const response = await axios.post(
            `${this.url}/collections/${this.collectionName}/points/delete`,
            { points: ids },
            { headers: this.headers() }
        );
        return response.data;
    }

    async getCollectionInfo(): Promise<any> {
        const response = await axios.get(
            `${this.url}/collections/${this.collectionName}`,
            { headers: this.headers() }
        );
        return response.data.result;
    }
}

export enum QdrantDistance {
    Cosine = "Cosine",
    Euclid = "Euclid",
    Dot = "Dot",
}

import axios from "axios";

export interface QdrantOptions {
    url: string;
    apiKey?: string;
}

export interface QdrantSearchOptions {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: object;
    withPayload?: boolean;
}

export class Qdrant {
    private url: string;
    private apiKey: string;

    constructor(options: QdrantOptions) {
        this.url = options.url.replace(/\/$/, ""); // Remove trailing slash
        this.apiKey = options.apiKey || "";
    }

    private get headers() {
        return {
            "Content-Type": "application/json",
            ...(this.apiKey ? { "api-key": this.apiKey } : {}),
        };
    }

    async createCollection(collectionName: string, vectorSize: number, distance: "Cosine" | "Euclidean" | "Dot" = "Cosine") {
        return await axios.put(
            `${this.url}/collections/${collectionName}`,
            {
                vectors: {
                    size: vectorSize,
                    distance: distance,
                },
            },
            { headers: this.headers }
        );
    }

    async upsert(collectionName: string, points: { id: string | number; vector: number[]; payload?: object }[]) {
        return await axios.put(
            `${this.url}/collections/${collectionName}/points`,
            { points },
            { headers: this.headers }
        );
    }

    async search(options: QdrantSearchOptions) {
        const response = await axios.post(
            `${this.url}/collections/${options.collectionName}/points/search`,
            {
                vector: options.vector,
                limit: options.limit || 10,
                filter: options.filter,
                with_payload: options.withPayload ?? true,
            },
            { headers: this.headers }
        );
        return response.data.result;
    }

    async deletePoints(collectionName: string, ids: (string | number)[]) {
        return await axios.post(
            `${this.url}/collections/${collectionName}/points/delete`,
            { points: ids },
            { headers: this.headers }
        );
    }
}

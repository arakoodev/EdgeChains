import axios from "axios";

export interface QdrantConfig {
    url: string;
    apiKey?: string;
}

export interface QdrantPoint {
    id: number | string;
    vector: number[];
    payload?: Record<string, any>;
}

export class Qdrant {
    url: string;
    apiKey?: string;

    constructor(config: QdrantConfig) {
        this.url = config.url.replace(/\/$/, "");
        this.apiKey = config.apiKey || process.env.QDRANT_API_KEY;
    }

    private getHeaders() {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }
        return headers;
    }

    async createCollection(
        collectionName: string,
        size: number,
        distance: "Cosine" | "Euclid" | "Dot" = "Cosine"
    ): Promise<any> {
        const config = {
            method: "put",
            url: `${this.url}/collections/${collectionName}`,
            headers: this.getHeaders(),
            data: {
                vectors: {
                    size,
                    distance,
                },
            },
        };
        const res = await axios.request(config);
        return res.data;
    }

    async upsertPoints(collectionName: string, points: QdrantPoint[]): Promise<any> {
        const config = {
            method: "put",
            url: `${this.url}/collections/${collectionName}/points?wait=true`,
            headers: this.getHeaders(),
            data: {
                points,
            },
        };
        const res = await axios.request(config);
        return res.data;
    }

    async searchPoints(
        collectionName: string,
        vector: number[],
        limit = 10,
        filter?: any
    ): Promise<any> {
        const config = {
            method: "post",
            url: `${this.url}/collections/${collectionName}/points/search`,
            headers: this.getHeaders(),
            data: {
                vector,
                limit,
                ...(filter && { filter }),
            },
        };
        const res = await axios.request(config);
        return res.data;
    }

    async deletePoints(collectionName: string, ids: (number | string)[]): Promise<any> {
        const config = {
            method: "post",
            url: `${this.url}/collections/${collectionName}/points/delete?wait=true`,
            headers: this.getHeaders(),
            data: {
                ids,
            },
        };
        const res = await axios.request(config);
        return res.data;
    }

    async deleteCollection(collectionName: string): Promise<any> {
        const config = {
            method: "delete",
            url: `${this.url}/collections/${collectionName}`,
            headers: this.getHeaders(),
        };
        const res = await axios.request(config);
        return res.data;
    }
}

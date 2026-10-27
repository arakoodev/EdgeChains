import axios from "axios";

export type QdrantDistanceMetric = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export class QdrantClient {
    url: string;
    apiKey?: string;

    constructor(url?: string, apiKey?: string) {
        this.url = (url || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/+$/, "");
        this.apiKey = apiKey || process.env.QDRANT_API_KEY;
    }

    private headers(): Record<string, string> {
        const h: Record<string, string> = { "Content-Type": "application/json" };
        if (this.apiKey) {
            h["api-key"] = this.apiKey;
        }
        return h;
    }

    async createCollection(
        collectionName: string,
        vectorSize: number,
        distance: QdrantDistanceMetric = "Cosine"
    ): Promise<any> {
        const res = await axios.put(
            `${this.url}/collections/${collectionName}`,
            { vectors: { size: vectorSize, distance } },
            { headers: this.headers() }
        );
        return res.data;
    }

    async insertVectorData({
        collectionName,
        points,
        wait = true,
    }: {
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        const res = await axios.put(
            `${this.url}/collections/${collectionName}/points?wait=${wait}`,
            { points },
            { headers: this.headers() }
        );
        return res.data;
    }

    async getDataFromQuery({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        vector: number[];
        limit?: number;
        filter?: Record<string, any>;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        const res = await axios.post(
            `${this.url}/collections/${collectionName}/points/search`,
            {
                vector,
                limit,
                ...(filter ? { filter } : {}),
                with_payload: withPayload,
                with_vector: withVector,
            },
            { headers: this.headers() }
        );
        return res.data?.result ?? res.data;
    }

    async getDataById({
        collectionName,
        id,
    }: {
        collectionName: string;
        id: string | number;
    }): Promise<any> {
        const res = await axios.get(
            `${this.url}/collections/${collectionName}/points/${id}`,
            { headers: this.headers() }
        );
        return res.data?.result ?? res.data;
    }

    async updateById({
        collectionName,
        id,
        updatedContent,
        wait = true,
    }: {
        collectionName: string;
        id: string | number;
        updatedContent: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        const res = await axios.post(
            `${this.url}/collections/${collectionName}/points/payload?wait=${wait}`,
            {
                payload: updatedContent,
                points: [id],
            },
            { headers: this.headers() }
        );
        return res.data;
    }

    async deleteById({
        collectionName,
        id,
        wait = true,
    }: {
        collectionName: string;
        id: string | number;
        wait?: boolean;
    }): Promise<any> {
        const res = await axios.post(
            `${this.url}/collections/${collectionName}/points/delete?wait=${wait}`,
            { points: [id] },
            { headers: this.headers() }
        );
        return res.data;
    }
}

export { QdrantClient as Qdrant };

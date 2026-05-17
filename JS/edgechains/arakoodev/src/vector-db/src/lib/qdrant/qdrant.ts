import axios, { AxiosRequestConfig } from "axios";
import { config } from "dotenv";
config();

type QdrantVector = number[];
type QdrantPayload = Record<string, unknown>;

interface QdrantPoint {
    id: string | number;
    vector: QdrantVector;
    payload?: QdrantPayload;
}

interface QdrantCollectionOptions {
    collectionName: string;
    vectorSize: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

interface QdrantSearchOptions {
    collectionName: string;
    vector: QdrantVector;
    limit?: number;
    filter?: QdrantPayload;
    withPayload?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    private requestConfig(): AxiosRequestConfig {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        return { headers };
    }

    private collectionUrl(collectionName: string, path = ""): string {
        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required to use the Qdrant vector database client.");
        }

        return `${this.QDRANT_URL}/collections/${collectionName}${path}`;
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: QdrantCollectionOptions): Promise<any> {
        const response = await axios.put(
            this.collectionUrl(collectionName),
            {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            },
            this.requestConfig()
        );

        return response.data;
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
        const response = await axios.put(
            this.collectionUrl(collectionName, `/points?wait=${wait}`),
            { points },
            this.requestConfig()
        );

        return response.data;
    }

    async search({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
    }: QdrantSearchOptions): Promise<any> {
        const response = await axios.post(
            this.collectionUrl(collectionName, "/points/search"),
            {
                vector,
                limit,
                filter,
                with_payload: withPayload,
            },
            this.requestConfig()
        );

        return response.data;
    }

    async getDataById({
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        id: string | number;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        const response = await axios.get(
            this.collectionUrl(
                collectionName,
                `/points/${id}?with_payload=${withPayload}&with_vector=${withVector}`
            ),
            this.requestConfig()
        );

        return response.data;
    }

    async deleteById({
        collectionName,
        ids,
        wait = true,
    }: {
        collectionName: string;
        ids: Array<string | number>;
        wait?: boolean;
    }): Promise<any> {
        const response = await axios.post(
            this.collectionUrl(collectionName, `/points/delete?wait=${wait}`),
            {
                points: ids,
            },
            this.requestConfig()
        );

        return response.data;
    }
}

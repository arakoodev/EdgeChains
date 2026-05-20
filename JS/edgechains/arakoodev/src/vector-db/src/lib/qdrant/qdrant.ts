import axios from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

interface QdrantInsertArgs {
    collectionName: string;
    points: {
        id: string | number;
        vector: number[];
        payload?: Record<string, any>;
    }[];
}

interface QdrantSearchArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
}

interface QdrantDeleteArgs {
    collectionName: string;
    points?: (string | number)[];
    filter?: Record<string, any>;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY!;

        if (!this.QDRANT_URL) {
            throw new Error("Qdrant URL is required. Please provide it in the constructor or as QDRANT_URL environment variable.");
        }
    }

    private async request(method: string, path: string, data?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async () => {
                try {
                    const response = await axios({
                        method,
                        url: `${this.QDRANT_URL}${path}`,
                        headers: {
                            "Content-Type": "application/json",
                            ...(this.QDRANT_API_KEY && { "api-key": this.QDRANT_API_KEY }),
                        },
                        data,
                    });
                    resolve(response.data);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error);
                }
            });
        });
    }

    async createCollection(collectionName: string, vectorSize: number, distance: "Cosine" | "Euclidean" | "Dot" = "Cosine") {
        return this.request("PUT", `/collections/${collectionName}`, {
            vectors: {
                size: vectorSize,
                distance,
            },
        });
    }

    async insertVectorData({ collectionName, points }: QdrantInsertArgs) {
        return this.request("PUT", `/collections/${collectionName}/points?wait=true`, {
            points,
        });
    }

    async searchVectorData({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: QdrantSearchArgs) {
        return this.request("POST", `/collections/${collectionName}/points/search`, {
            vector,
            limit,
            filter,
            with_payload: withPayload,
            with_vector: withVector,
        });
    }

    async deleteVectorData({ collectionName, points, filter }: QdrantDeleteArgs) {
        return this.request("POST", `/collections/${collectionName}/points/delete?wait=true`, {
            points,
            filter,
        });
    }
}

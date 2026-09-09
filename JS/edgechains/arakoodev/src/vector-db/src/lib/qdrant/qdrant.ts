interface QdrantConstructionOptions {
    url?: string;
    apiKey?: string;
}

interface QdrantVectorParams {
    size: number;
    distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

interface QdrantSearchArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    scoreThreshold?: number;
}

interface QdrantRequestOptions {
    method?: string;
    body?: Record<string, any>;
}

interface QdrantClient {
    request(path: string, options?: QdrantRequestOptions): Promise<any>;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(options: QdrantConstructionOptions = {}) {
        this.QDRANT_URL = (options.url || process.env.QDRANT_URL || "http://localhost:6333").replace(
            /\/$/,
            ""
        );
        this.QDRANT_API_KEY = options.apiKey || process.env.QDRANT_API_KEY;
    }

    createClient(): QdrantClient {
        return {
            request: async (path: string, options: QdrantRequestOptions = {}) => {
                const response = await fetch(`${this.QDRANT_URL}${path}`, {
                    method: options.method || "GET",
                    headers: {
                        "Content-Type": "application/json",
                        ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
                    },
                    body: options.body ? JSON.stringify(options.body) : undefined,
                });

                const data = await response.json().catch(() => undefined);
                if (!response.ok) {
                    throw new Error(
                        `Qdrant request failed with status ${response.status}: ${JSON.stringify(data)}`
                    );
                }
                return data;
            },
        };
    }

    async createCollection({
        client,
        collectionName,
        vectors,
    }: {
        client: QdrantClient;
        collectionName: string;
        vectors: QdrantVectorParams;
    }): Promise<any> {
        return client.request(`/collections/${collectionName}`, {
            method: "PUT",
            body: { vectors },
        });
    }

    async getCollectionInfo({
        client,
        collectionName,
    }: {
        client: QdrantClient;
        collectionName: string;
    }): Promise<any> {
        return client.request(`/collections/${collectionName}`);
    }

    async insertVectorData({
        client,
        collectionName,
        points,
    }: {
        client: QdrantClient;
        collectionName: string;
        points: QdrantPoint[];
    }): Promise<any> {
        return client.request(`/collections/${collectionName}/points`, {
            method: "PUT",
            body: { points },
        });
    }

    async getDataFromQuery({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        scoreThreshold,
    }: QdrantSearchArgs & { client: QdrantClient }): Promise<any> {
        return client.request(`/collections/${collectionName}/points/search`, {
            method: "POST",
            body: {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                score_threshold: scoreThreshold,
            },
        });
    }

    async deleteById({
        client,
        collectionName,
        points,
    }: {
        client: QdrantClient;
        collectionName: string;
        points: Array<string | number>;
    }): Promise<any> {
        return client.request(`/collections/${collectionName}/points/delete`, {
            method: "POST",
            body: { points },
        });
    }

    async deleteCollection({
        client,
        collectionName,
    }: {
        client: QdrantClient;
        collectionName: string;
    }): Promise<any> {
        return client.request(`/collections/${collectionName}`, { method: "DELETE" });
    }
}

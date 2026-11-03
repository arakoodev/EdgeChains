type QdrantId = string | number;
type QdrantVector = number[];

interface QdrantClient {
    url: string;
    apiKey?: string;
    headers: Record<string, string>;
}

interface QdrantPoint {
    id: QdrantId;
    vector: QdrantVector;
    payload?: Record<string, any>;
}

interface QdrantRequestOptions {
    method?: string;
    body?: unknown;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient(): QdrantClient {
        if (!this.QDRANT_URL) throw new Error("QDRANT_URL is required");
        return {
            url: this.QDRANT_URL,
            apiKey: this.QDRANT_API_KEY,
            headers: {
                "content-type": "application/json",
                ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
            },
        };
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: {
        client: QdrantClient;
        collectionName: string;
        vectorSize: number;
        distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
    }): Promise<any> {
        return this.request(client, `/collections/${collectionName}`, {
            method: "PUT",
            body: { vectors: { size: vectorSize, distance } },
        });
    }

    async insertVectorData({
        client,
        tableName,
        collectionName = tableName,
        points,
        id,
        vector,
        embedding,
        payload,
        ...args
    }: {
        client: QdrantClient;
        tableName?: string;
        collectionName?: string;
        points?: QdrantPoint[];
        id?: QdrantId;
        vector?: QdrantVector;
        embedding?: QdrantVector;
        payload?: Record<string, any>;
        [key: string]: any;
    }): Promise<any> {
        if (!collectionName) throw new Error("collectionName or tableName is required");
        const bodyPoints = points || [
            {
                id: id ?? args.pointId ?? args.documentId,
                vector: vector || embedding || args.vectors,
                payload: payload || this.payloadFromArgs(args),
            },
        ];
        for (const point of bodyPoints) {
            if (point.id === undefined || point.id === null) throw new Error("Qdrant point id is required");
            if (!Array.isArray(point.vector)) throw new Error("Qdrant point vector is required");
        }
        return this.request(client, `/collections/${collectionName}/points`, {
            method: "PUT",
            body: { points: bodyPoints },
        });
    }

    async getDataFromQuery({
        client,
        tableName,
        collectionName = tableName,
        queryVector,
        vector,
        embedding,
        limit = 10,
        filter,
        with_payload = true,
        with_vector = false,
        score_threshold,
    }: {
        client: QdrantClient;
        tableName?: string;
        collectionName?: string;
        queryVector?: QdrantVector;
        vector?: QdrantVector;
        embedding?: QdrantVector;
        limit?: number;
        filter?: Record<string, any>;
        with_payload?: boolean;
        with_vector?: boolean;
        score_threshold?: number;
    }): Promise<any> {
        if (!collectionName) throw new Error("collectionName or tableName is required");
        const query = queryVector || vector || embedding;
        if (!Array.isArray(query)) throw new Error("queryVector, vector, or embedding is required");
        const res = await this.request(client, `/collections/${collectionName}/points/search`, {
            method: "POST",
            body: { vector: query, limit, filter, with_payload, with_vector, score_threshold },
        });
        return res.result;
    }

    async getData({
        client,
        tableName,
        collectionName = tableName,
        limit = 10,
        offset,
        filter,
        with_payload = true,
        with_vector = false,
    }: {
        client: QdrantClient;
        tableName?: string;
        collectionName?: string;
        limit?: number;
        offset?: QdrantId;
        filter?: Record<string, any>;
        with_payload?: boolean;
        with_vector?: boolean;
    }): Promise<any> {
        if (!collectionName) throw new Error("collectionName or tableName is required");
        const res = await this.request(client, `/collections/${collectionName}/points/scroll`, {
            method: "POST",
            body: { limit, offset, filter, with_payload, with_vector },
        });
        return res.result;
    }

    async getDataById({
        client,
        tableName,
        collectionName = tableName,
        id,
        with_payload = true,
        with_vector = false,
    }: {
        client: QdrantClient;
        tableName?: string;
        collectionName?: string;
        id: QdrantId;
        with_payload?: boolean;
        with_vector?: boolean;
    }): Promise<any> {
        if (!collectionName) throw new Error("collectionName or tableName is required");
        const res = await this.request(client, `/collections/${collectionName}/points`, {
            method: "POST",
            body: { ids: [id], with_payload, with_vector },
        });
        return res.result?.[0] ?? null;
    }

    async updateById({
        client,
        tableName,
        collectionName = tableName,
        id,
        updatedContent,
    }: {
        client: QdrantClient;
        tableName?: string;
        collectionName?: string;
        id: QdrantId;
        updatedContent: Record<string, any>;
    }): Promise<any> {
        if (!collectionName) throw new Error("collectionName or tableName is required");
        return this.request(client, `/collections/${collectionName}/points/payload`, {
            method: "POST",
            body: { payload: updatedContent, points: [id] },
        });
    }

    async deleteById({
        client,
        tableName,
        collectionName = tableName,
        id,
    }: {
        client: QdrantClient;
        tableName?: string;
        collectionName?: string;
        id: QdrantId;
    }): Promise<any> {
        if (!collectionName) throw new Error("collectionName or tableName is required");
        return this.request(client, `/collections/${collectionName}/points/delete`, {
            method: "POST",
            body: { points: [id] },
        });
    }

    private payloadFromArgs(args: Record<string, any>): Record<string, any> {
        const { pointId, documentId, vectors, client, tableName, collectionName, ...payload } = args;
        return payload;
    }

    private async request(client: QdrantClient, path: string, options: QdrantRequestOptions): Promise<any> {
        const response = await fetch(`${client.url}${path}`, {
            method: options.method || "GET",
            headers: client.headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        const body = await response.json().catch(() => undefined);
        if (!response.ok) {
            throw new Error(`Qdrant request failed: ${response.status} ${response.statusText} ${JSON.stringify(body)}`);
        }
        return body;
    }
}

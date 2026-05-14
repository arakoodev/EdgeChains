import { config } from "dotenv";
config();

type QdrantFetchResponse = {
    ok: boolean;
    status: number;
    statusText: string;
    text: () => Promise<string>;
};

type QdrantFetch = (
    input: string,
    init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    }
) => Promise<QdrantFetchResponse>;

export type QdrantClient = {
    url: string;
    apiKey?: string;
    fetch: QdrantFetch;
};

type QdrantPointId = string | number;

type QdrantPoint = {
    id: QdrantPointId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
};

type QdrantFilter = Record<string, any>;

type QdrantSearchArgs = {
    client: QdrantClient;
    collectionName: string;
    vector: number[] | Record<string, number[]>;
    limit?: number;
    filter?: QdrantFilter;
    params?: Record<string, any>;
    scoreThreshold?: number;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
};

type InsertVectorDataArgs = {
    client: QdrantClient;
    collectionName: string;
    id: QdrantPointId;
    vector?: number[] | Record<string, number[]>;
    embedding?: number[];
    payload?: Record<string, any>;
    wait?: boolean;
};

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;
    private fetcher?: QdrantFetch;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string, fetcher?: QdrantFetch) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
        this.fetcher = fetcher;
    }

    createClient(): QdrantClient {
        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required to create a Qdrant client");
        }

        return {
            url: this.QDRANT_URL.replace(/\/+$/, ""),
            apiKey: this.QDRANT_API_KEY,
            fetch: this.fetcher || this.getGlobalFetch(),
        };
    }

    async insertVectorData({
        client,
        collectionName,
        id,
        vector,
        embedding,
        payload,
        wait = true,
    }: InsertVectorDataArgs): Promise<any> {
        const pointVector = vector || embedding;
        if (!pointVector) {
            throw new Error("Qdrant insertVectorData requires either vector or embedding");
        }

        return this.upsertPoints({
            client,
            collectionName,
            points: [{ id, vector: pointVector, payload }],
            wait,
        });
    }

    async upsertPoints({
        client,
        collectionName,
        points,
        wait = true,
    }: {
        client: QdrantClient;
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        return this.request(
            client,
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`,
            {
                method: "PUT",
                body: JSON.stringify({ points }),
            }
        );
    }

    async getDataFromQuery({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        params,
        scoreThreshold,
        withPayload = true,
        withVector = false,
    }: QdrantSearchArgs): Promise<any> {
        const body: Record<string, any> = {
            vector,
            limit,
            with_payload: withPayload,
            with_vector: withVector,
        };

        if (filter) body.filter = filter;
        if (params) body.params = params;
        if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold;

        return this.request(client, `/collections/${encodeURIComponent(collectionName)}/points/search`, {
            method: "POST",
            body: JSON.stringify(body),
        });
    }

    async getDataById({
        client,
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: {
        client: QdrantClient;
        collectionName: string;
        id: QdrantPointId;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        const searchParams = new URLSearchParams({
            with_payload: String(withPayload),
            with_vector: String(withVector),
        });

        return this.request(
            client,
            `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(
                String(id)
            )}?${searchParams.toString()}`
        );
    }

    async updateById({
        client,
        collectionName,
        id,
        updatedContent,
        wait = true,
    }: {
        client: QdrantClient;
        collectionName: string;
        id: QdrantPointId;
        updatedContent: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        return this.request(
            client,
            `/collections/${encodeURIComponent(collectionName)}/points/payload?wait=${wait}`,
            {
                method: "POST",
                body: JSON.stringify({
                    payload: updatedContent,
                    points: [id],
                }),
            }
        );
    }

    async deleteById({
        client,
        collectionName,
        id,
        wait = true,
    }: {
        client: QdrantClient;
        collectionName: string;
        id: QdrantPointId;
        wait?: boolean;
    }): Promise<any> {
        return this.request(
            client,
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait}`,
            {
                method: "POST",
                body: JSON.stringify({ points: [id] }),
            }
        );
    }

    private getGlobalFetch(): QdrantFetch {
        if (!globalThis.fetch) {
            throw new Error("A fetch implementation is required to use Qdrant");
        }

        return globalThis.fetch.bind(globalThis) as QdrantFetch;
    }

    private async request(
        client: QdrantClient,
        path: string,
        init: {
            method?: string;
            body?: string;
        } = {}
    ): Promise<any> {
        const headers: Record<string, string> = {
            "content-type": "application/json",
        };

        if (client.apiKey) {
            headers["api-key"] = client.apiKey;
        }

        const response = await client.fetch(`${client.url}${path}`, {
            method: init.method || "GET",
            headers,
            body: init.body,
        });

        const responseText = await response.text();
        let data: any;
        if (responseText) {
            try {
                data = JSON.parse(responseText);
            } catch (error) {
                if (response.ok) {
                    throw error;
                }
            }
        }

        if (!response.ok) {
            const message =
                data?.status?.error ||
                data?.message ||
                responseText ||
                response.statusText ||
                "Unknown Qdrant error";
            throw new Error(`Qdrant request failed (${response.status}): ${message}`);
        }

        return data;
    }
}

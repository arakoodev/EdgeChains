export interface QdrantClient {
    url: string;
    apiKey?: string;
}

export interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, unknown>;
}

export interface QdrantSearchResult {
    id: string | number;
    score: number;
    payload?: Record<string, unknown>;
    vector?: unknown;
}

interface RequestOptions {
    method?: "GET" | "PUT" | "POST" | "DELETE";
    body?: unknown;
}

/** Dependency-free wrapper around Qdrant's public REST API. */
export class Qdrant {
    constructor(
        private readonly url: string = process.env.QDRANT_URL || "",
        private readonly apiKey: string = process.env.QDRANT_API_KEY || ""
    ) {}

    createClient(): QdrantClient {
        if (!this.url) throw new Error("Qdrant URL is required");
        return { url: this.url.replace(/\/$/, ""), apiKey: this.apiKey || undefined };
    }

    private async request<T>(client: QdrantClient, path: string, options: RequestOptions = {}): Promise<T> {
        const response = await fetch(`${client.url}${path}`, {
            method: options.method || "GET",
            headers: {
                "content-type": "application/json",
                ...(client.apiKey ? { "api-key": client.apiKey } : {}),
            },
            ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        });
        const data = await response.json() as { result?: T; status?: unknown };
        if (!response.ok) throw new Error(`Qdrant request failed (${response.status})`);
        return (data.result === undefined ? data : data.result) as T;
    }

    createCollection({ client, collectionName, vectorSize, distance = "Cosine" }: {
        client: QdrantClient; collectionName: string; vectorSize: number;
        distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
    }): Promise<unknown> {
        return this.request(client, `/collections/${encodeURIComponent(collectionName)}`, {
            method: "PUT", body: { vectors: { size: vectorSize, distance } },
        });
    }

    insertVectorData({ client, collectionName, points, wait = true }: {
        client: QdrantClient; collectionName: string; points: QdrantPoint[]; wait?: boolean;
    }): Promise<unknown> {
        return this.request(client,
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`, {
                method: "PUT", body: { points },
            });
    }

    async getDataFromQuery({ client, collectionName, vector, limit = 10, filter,
        withPayload = true }: {
        client: QdrantClient; collectionName: string; vector: number[];
        limit?: number; filter?: Record<string, unknown>; withPayload?: boolean;
    }): Promise<QdrantSearchResult[]> {
        return this.request(client,
            `/collections/${encodeURIComponent(collectionName)}/points/search`, {
                method: "POST", body: {
                    vector, limit, with_payload: withPayload, ...(filter ? { filter } : {}),
                },
            });
    }

    async getData({ client, collectionName, limit = 10, offset, filter,
        withPayload = true, withVector = false }: {
        client: QdrantClient; collectionName: string; limit?: number;
        offset?: string | number; filter?: Record<string, unknown>;
        withPayload?: boolean; withVector?: boolean;
    }): Promise<unknown> {
        return this.request(client,
            `/collections/${encodeURIComponent(collectionName)}/points/scroll`, {
                method: "POST", body: { limit, with_payload: withPayload,
                    with_vector: withVector, ...(offset === undefined ? {} : { offset }),
                    ...(filter ? { filter } : {}) },
            });
    }

    getDataById({ client, collectionName, id, withPayload = true, withVector = false }: {
        client: QdrantClient; collectionName: string; id: string | number;
        withPayload?: boolean; withVector?: boolean;
    }): Promise<unknown> {
        return this.request(client,
            `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(id)}` +
            `?with_payload=${withPayload}&with_vector=${withVector}`);
    }

    updateById({ client, collectionName, id, payload, wait = true }: {
        client: QdrantClient; collectionName: string; id: string | number;
        payload: Record<string, unknown>; wait?: boolean;
    }): Promise<unknown> {
        return this.request(client,
            `/collections/${encodeURIComponent(collectionName)}/points/payload?wait=${wait}`, {
                method: "POST", body: { payload, points: [id] },
            });
    }

    deleteById({ client, collectionName, id, wait = true }: {
        client: QdrantClient; collectionName: string; id: string | number; wait?: boolean;
    }): Promise<unknown> {
        return this.request(client,
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait}`, {
                method: "POST", body: { points: [id] },
            });
    }
}

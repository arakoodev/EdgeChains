type PointId = string | number;

interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
}

interface UpsertPoint {
    id: PointId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

interface UpsertPointsArgs {
    collectionName: string;
    points: UpsertPoint[];
    wait?: boolean;
}

interface SearchPointsArgs {
    collectionName: string;
    vector: number[] | Record<string, number[]>;
    limit?: number;
    offset?: number;
    using?: string;
    filter?: Record<string, any>;
    params?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[] | Record<string, any>;
    scoreThreshold?: number;
}

interface GetPointByIdArgs {
    collectionName: string;
    id: PointId;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[] | Record<string, any>;
}

interface DeleteByIdArgs {
    collectionName: string;
    ids: PointId[];
    wait?: boolean;
}

interface SetPayloadArgs {
    collectionName: string;
    payload: Record<string, any>;
    points: PointId[];
    wait?: boolean;
}

export class Qdrant {
    url: string;
    apiKey?: string;

    constructor({ url, apiKey }: QdrantClientOptions = {}) {
        this.url = (url || process.env.QDRANT_URL || "").replace(/\/+$/, "");
        this.apiKey = apiKey || process.env.QDRANT_API_KEY;

        if (!this.url) {
            throw new Error("Qdrant URL is required. Pass url or set QDRANT_URL.");
        }
    }

    async upsertPoints({ collectionName, points, wait = true }: UpsertPointsArgs): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`,
            {
                method: "PUT",
                body: { points },
            }
        );
    }

    async searchPoints({
        collectionName,
        vector,
        limit = 10,
        offset,
        using,
        filter,
        params,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: SearchPointsArgs): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points/query`, {
            method: "POST",
            body: {
                query: vector,
                limit,
                offset,
                using,
                filter,
                params,
                with_payload: withPayload,
                with_vector: withVector,
                score_threshold: scoreThreshold,
            },
        });
    }

    async getPointById({
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: GetPointByIdArgs): Promise<any> {
        const query = new URLSearchParams({
            with_payload: this.encodeQueryValue(withPayload),
            with_vector: this.encodeQueryValue(withVector),
        });

        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(
                String(id)
            )}?${query.toString()}`,
            { method: "GET" }
        );
    }

    async deleteById({ collectionName, ids, wait = true }: DeleteByIdArgs): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait}`,
            {
                method: "POST",
                body: {
                    points: ids,
                },
            }
        );
    }

    async setPayload({ collectionName, payload, points, wait = true }: SetPayloadArgs): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/payload?wait=${wait}`,
            {
                method: "POST",
                body: {
                    payload,
                    points,
                },
            }
        );
    }

    private async request(
        path: string,
        options: { method: string; body?: Record<string, any> }
    ): Promise<any> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }

        const response = await fetch(`${this.url}${path}`, {
            method: options.method,
            headers,
            body: options.body ? JSON.stringify(this.removeUndefined(options.body)) : undefined,
        });

        const responseText = await response.text();
        const data = responseText ? JSON.parse(responseText) : null;

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with status ${response.status}: ${JSON.stringify(data)}`
            );
        }

        return data?.result ?? data;
    }

    private removeUndefined(input: Record<string, any>): Record<string, any> {
        return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    }

    private encodeQueryValue(value: boolean | string[] | Record<string, any>): string {
        return typeof value === "boolean" ? String(value) : JSON.stringify(value);
    }
}

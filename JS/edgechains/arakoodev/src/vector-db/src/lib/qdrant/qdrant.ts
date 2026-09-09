export type QdrantDistance = "Cosine" | "Dot" | "Euclid" | "Manhattan";

export type QdrantVector = number[] | Record<string, number[]>;

export interface QdrantPoint {
    id: string | number;
    vector: QdrantVector;
    payload?: Record<string, unknown>;
}

export interface QdrantCreateCollectionArgs {
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistance;
}

export interface QdrantSearchArgs {
    collectionName: string;
    vector: QdrantVector;
    limit?: number;
    filter?: Record<string, unknown>;
    withPayload?: boolean | string[];
    withVector?: boolean;
    scoreThreshold?: number;
}

export interface QdrantScrollArgs {
    collectionName: string;
    limit?: number;
    offset?: string | number;
    filter?: Record<string, unknown>;
    withPayload?: boolean | string[];
    withVector?: boolean;
}

type QdrantFetcher = (
    input: string | URL | Request,
    init?: RequestInit
) => Promise<Response>;

/**
 * Small REST client for Qdrant's HTTP API.
 *
 * The client intentionally uses fetch instead of the Qdrant SDK so it can be
 * used in Node, browsers, and EdgeChains' WASM-oriented examples without an
 * additional database dependency.
 */
export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;
    private readonly fetcher: QdrantFetcher;

    constructor(
        QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333",
        QDRANT_API_KEY = process.env.QDRANT_API_KEY || "",
        fetcher: QdrantFetcher = globalThis.fetch.bind(globalThis)
    ) {
        this.QDRANT_URL = QDRANT_URL.replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY;
        this.fetcher = fetcher;
    }

    /** Return this client, mirroring the Supabase adapter's createClient API. */
    createClient(): Qdrant {
        return this;
    }

    private collectionPath(collectionName: string, suffix = ""): string {
        return `/collections/${encodeURIComponent(collectionName)}${suffix}`;
    }

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const headers = new Headers(init.headers);
        headers.set("content-type", "application/json");
        if (this.QDRANT_API_KEY) headers.set("api-key", this.QDRANT_API_KEY);

        const response = await this.fetcher(`${this.QDRANT_URL}${path}`, {
            ...init,
            headers,
        });
        const text = await response.text();
        let body: any;
        if (text) {
            try {
                body = JSON.parse(text);
            } catch {
                body = text;
            }
        }

        if (!response.ok) {
            const message =
                body?.status?.error || body?.error || body || `${response.status} ${response.statusText}`;
            throw new Error(`Qdrant request failed (${response.status}): ${message}`);
        }

        return (body && Object.prototype.hasOwnProperty.call(body, "result") ? body.result : body) as T;
    }

    async createCollection(
        collectionName: string,
        vectorSize: number,
        distance?: QdrantDistance
    ): Promise<any>;
    async createCollection(args: QdrantCreateCollectionArgs): Promise<any>;
    async createCollection(
        collectionOrArgs: string | QdrantCreateCollectionArgs,
        vectorSize?: number,
        distance: QdrantDistance = "Cosine"
    ): Promise<any> {
        const args =
            typeof collectionOrArgs === "string"
                ? { collectionName: collectionOrArgs, vectorSize, distance }
                : { distance: "Cosine" as QdrantDistance, ...collectionOrArgs };
        const size = args.vectorSize;
        if (!args.collectionName || !Number.isInteger(size) || size === undefined || size <= 0) {
            throw new Error("collectionName and a positive integer vectorSize are required");
        }
        return this.request(this.collectionPath(args.collectionName), {
            method: "PUT",
            body: JSON.stringify({ vectors: { size, distance: args.distance } }),
        });
    }

    async getCollectionInfo(collectionName: string): Promise<any> {
        return this.request(this.collectionPath(collectionName));
    }

    async deleteCollection(collectionName: string): Promise<any> {
        return this.request(this.collectionPath(collectionName), { method: "DELETE" });
    }

    async upsertPoints(
        collectionName: string,
        points: QdrantPoint[],
        wait?: boolean
    ): Promise<any>;
    async upsertPoints(args: {
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any>;
    async upsertPoints(
        collectionOrArgs: string | { collectionName: string; points: QdrantPoint[]; wait?: boolean },
        points?: QdrantPoint[],
        wait = true
    ): Promise<any> {
        const args =
            typeof collectionOrArgs === "string"
                ? { collectionName: collectionOrArgs, points: points || [], wait }
                : { wait: true, ...collectionOrArgs };
        if (!args.collectionName || args.points.length === 0) {
            throw new Error("collectionName and at least one point are required");
        }
        const query = args.wait === undefined ? "" : `?wait=${args.wait}`;
        return this.request(this.collectionPath(args.collectionName, `/points${query}`), {
            method: "PUT",
            body: JSON.stringify({ points: args.points }),
        });
    }

    async search(
        collectionName: string,
        vector: QdrantVector,
        limit?: number,
        options?: Omit<QdrantSearchArgs, "collectionName" | "vector" | "limit">
    ): Promise<any[]>;
    async search(args: QdrantSearchArgs): Promise<any[]>;
    async search(
        collectionOrArgs: string | QdrantSearchArgs,
        vector?: QdrantVector,
        limit = 10,
        options: Omit<QdrantSearchArgs, "collectionName" | "vector" | "limit"> = {}
    ): Promise<any[]> {
        const args =
            typeof collectionOrArgs === "string"
                ? { collectionName: collectionOrArgs, vector, limit, ...options }
                : { limit: 10, ...collectionOrArgs };
        if (!args.collectionName || !args.vector) {
            throw new Error("collectionName and vector are required");
        }
        return this.request<any[]>(this.collectionPath(args.collectionName, "/points/search"), {
            method: "POST",
            body: JSON.stringify({
                vector: args.vector,
                limit: args.limit,
                ...(args.filter ? { filter: args.filter } : {}),
                ...(args.withPayload !== undefined ? { with_payload: args.withPayload } : {}),
                ...(args.withVector !== undefined ? { with_vector: args.withVector } : {}),
                ...(args.scoreThreshold !== undefined ? { score_threshold: args.scoreThreshold } : {}),
            }),
        });
    }

    async scroll(args: QdrantScrollArgs): Promise<any> {
        const { collectionName, limit = 10, offset, filter, withPayload, withVector } = args;
        return this.request(this.collectionPath(collectionName, "/points/scroll"), {
            method: "POST",
            body: JSON.stringify({
                limit,
                ...(offset !== undefined ? { offset } : {}),
                ...(filter ? { filter } : {}),
                ...(withPayload !== undefined ? { with_payload: withPayload } : {}),
                ...(withVector !== undefined ? { with_vector: withVector } : {}),
            }),
        });
    }

    async getDataById({
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        id: string | number;
        withPayload?: boolean | string[];
        withVector?: boolean;
    }): Promise<any> {
        return this.request(this.collectionPath(collectionName, `/points/${encodeURIComponent(String(id))}`) +
            `?with_payload=${withPayload}&with_vector=${withVector}`);
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
        return this.request(this.collectionPath(collectionName, `/points/${encodeURIComponent(String(id))}?wait=${wait}`), {
            method: "DELETE",
        });
    }
}

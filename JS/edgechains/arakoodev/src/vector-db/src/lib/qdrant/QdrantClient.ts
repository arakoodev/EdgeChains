import axios, { AxiosInstance } from "axios";
import { config } from "dotenv";

config();

export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export type QdrantPointId = number | string;

export type QdrantFilter = Record<string, unknown>;

export interface QdrantPoint<Payload = Record<string, unknown>> {
    id: QdrantPointId;
    vector: number[] | Record<string, number[]>;
    payload?: Payload;
}

export interface QdrantSearchResult<Payload = Record<string, unknown>> {
    id: QdrantPointId;
    version?: number;
    score: number;
    payload?: Payload;
    vector?: number[] | Record<string, number[]>;
}

export interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
    timeoutMs?: number;
}

export interface CreateCollectionArgs {
    collectionName: string;
    vectorSize: number;
    distance: QdrantDistance;
    onDiskPayload?: boolean;
}

export interface UpsertPointsArgs<Payload = Record<string, unknown>> {
    collectionName: string;
    points: Array<QdrantPoint<Payload>>;
    wait?: boolean;
}

export interface SearchPointsArgs {
    collectionName: string;
    vector: number[] | Record<string, number[]>;
    limit: number;
    filter?: QdrantFilter;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean;
    scoreThreshold?: number;
}

export class QdrantClient {
    private client: AxiosInstance;

    constructor(options: QdrantClientOptions = {}) {
        const url = options.url || process.env.QDRANT_URL;
        if (!url) {
            throw new Error(
                "QdrantClient requires `url` option or env var `QDRANT_URL` (e.g. http://localhost:6333)"
            );
        }

        const apiKey = options.apiKey || process.env.QDRANT_API_KEY;

        this.client = axios.create({
            baseURL: url.replace(/\/+$/, ""),
            timeout: options.timeoutMs ?? 30_000,
            headers: apiKey ? { "api-key": apiKey } : undefined,
        });
    }

    async healthz() {
        const res = await this.client.get("/healthz");
        return res.data;
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance,
        onDiskPayload,
    }: CreateCollectionArgs) {
        const res = await this.client.put(`/collections/${encodeURIComponent(collectionName)}`, {
            vectors: {
                size: vectorSize,
                distance,
            },
            ...(onDiskPayload === undefined ? {} : { on_disk_payload: onDiskPayload }),
        });
        return res.data;
    }

    async upsertPoints<Payload = Record<string, unknown>>({
        collectionName,
        points,
        wait,
    }: UpsertPointsArgs<Payload>) {
        const res = await this.client.put(
            `/collections/${encodeURIComponent(collectionName)}/points`,
            { points },
            { params: wait === undefined ? undefined : { wait } }
        );
        return res.data;
    }

    async searchPoints<Payload = Record<string, unknown>>({
        collectionName,
        vector,
        limit,
        filter,
        withPayload,
        withVector,
        scoreThreshold,
    }: SearchPointsArgs): Promise<QdrantSearchResult<Payload>[]> {
        const res = await this.client.post(
            `/collections/${encodeURIComponent(collectionName)}/points/search`,
            {
                vector,
                limit,
                ...(filter ? { filter } : {}),
                ...(withPayload === undefined ? {} : { with_payload: withPayload }),
                ...(withVector === undefined ? {} : { with_vector: withVector }),
                ...(scoreThreshold === undefined ? {} : { score_threshold: scoreThreshold }),
            }
        );
        return res.data?.result ?? [];
    }
}

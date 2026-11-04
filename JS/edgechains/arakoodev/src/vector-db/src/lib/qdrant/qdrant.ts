import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

interface ArgsObject {
    [key: string]: any;
}

interface CreateCollectionArgs {
    client: AxiosInstance;
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistance;
    [key: string]: any;
}

interface UpsertPointsArgs {
    client: AxiosInstance;
    collectionName: string;
    points: Array<{ id: string | number; vector: number[]; payload?: Record<string, any> }>;
    wait?: boolean;
}

interface InsertVectorDataArgs {
    client: AxiosInstance;
    collectionName: string;
    [key: string]: any;
}

interface SearchArgs {
    client: AxiosInstance;
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
    scoreThreshold?: number;
}

interface GetDataFromQueryArgs {
    client: AxiosInstance;
    collectionName: string;
    vector: number[];
    [key: string]: any;
}

interface PointArgs {
    client: AxiosInstance;
    collectionName: string;
    id: string | number;
}

interface DeleteArgs {
    client: AxiosInstance;
    collectionName: string;
    ids?: Array<string | number>;
    filter?: Record<string, any>;
    wait?: boolean;
}

/**
 * EdgeChains wrapper around the Qdrant REST API (https://qdrant.github.io/qdrant/redoc/).
 * Calls the HTTP API directly - no qdrant client packages are used.
 */
export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
    }

    /**
     * Create an axios client pointed at the Qdrant REST API.
     * @returns Configured axios instance with base URL and API key header.
     */
    createClient(): AxiosInstance {
        return axios.create({
            baseURL: this.QDRANT_URL,
            headers: {
                "Content-Type": "application/json",
                ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
            },
        });
    }

    private runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
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
                    const res = await fn();
                    const qdrantStatus = (res as any)?.status;
                    if (qdrantStatus && qdrantStatus !== "ok") {
                        const err = new Error(
                            `Qdrant request failed with status "${JSON.stringify((res as any)?.status)}"`
                        );
                        if (operation.retry(err)) {
                            return;
                        }
                        reject(err);
                        return;
                    }
                    resolve(res);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error);
                }
            });
        });
    }

    /**
     * Create a collection in Qdrant.
     * @param client The axios client from createClient().
     * @param collectionName Name of the collection to create.
     * @param vectorSize Dimension of the vectors stored in the collection.
     * @param distance Distance metric: Cosine (default), Euclid, Dot or Manhattan.
     * @returns The Qdrant API response.
     */
    async createCollection({ client, collectionName, vectorSize, distance = "Cosine", ...args }: CreateCollectionArgs): Promise<any> {
        return this.runWithRetry(async () => {
            const res = await client.put(`/collections/${collectionName}`, {
                vectors: { size: vectorSize, distance },
                ...args,
            });
            return res.data;
        });
    }

    /**
     * Get information about a collection.
     * @param client The axios client from createClient().
     * @param collectionName Name of the collection.
     * @returns Collection info from the Qdrant API.
     */
    async getCollectionInfo({ client, collectionName }: { client: AxiosInstance; collectionName: string }): Promise<any> {
        return this.runWithRetry(async () => {
            const res = await client.get(`/collections/${collectionName}`);
            return res.data;
        });
    }

    /**
     * Upsert points into a collection.
     * @param client The axios client from createClient().
     * @param collectionName Target collection.
     * @param points Array of { id, vector, payload? }.
     * @param wait Wait for the operation to finish before returning (default true).
     * @returns The Qdrant API response.
     */
    async upsertPoints({ client, collectionName, points, wait = true }: UpsertPointsArgs): Promise<any> {
        return this.runWithRetry(async () => {
            const res = await client.put(`/collections/${collectionName}/points`, { points }, {
                params: { wait },
            });
            return res.data;
        });
    }

    /**
     * Insert vector data into a collection. Accepts arbitrary point fields the same way
     * the Supabase adapter accepts arbitrary columns.
     * @param client The axios client from createClient().
     * @param collectionName Target collection.
     * @param args Fields forming the point: requires id and vector; everything else goes to payload.
     * @returns The Qdrant API response.
     */
    async insertVectorData({ client, collectionName, ...args }: InsertVectorDataArgs): Promise<any> {
        const { id, vector, embedding, payload, ...rest } = args;
        const vec = vector || embedding;
        if (id === undefined || vec === undefined) {
            throw new Error("insertVectorData requires 'id' and 'vector' (or 'embedding') fields");
        }
        return this.upsertPoints({
            client,
            collectionName,
            points: [{ id, vector: vec, payload: payload || rest }],
        });
    }

    /**
     * Search a collection for the nearest neighbours of a vector.
     * @param client The axios client from createClient().
     * @param collectionName Collection to search.
     * @param vector Query vector.
     * @param limit Max results (default 10).
     * @param filter Optional Qdrant filter object.
     * @param withPayload Return point payloads (default true).
     * @param withVector Return point vectors (default false).
     * @param scoreThreshold Optional minimum score.
     * @returns Array of scored points from the Qdrant API result.
     */
    async search({ client, collectionName, vector, limit = 10, filter, withPayload = true, withVector = false, scoreThreshold }: SearchArgs): Promise<any> {
        return this.runWithRetry(async () => {
            const res = await client.post(`/collections/${collectionName}/points/search`, {
                vector,
                limit,
                ...(filter ? { filter } : {}),
                with_payload: withPayload,
                with_vector: withVector,
                ...(scoreThreshold !== undefined ? { score_threshold: scoreThreshold } : {}),
            });
            return res.data?.result;
        });
    }

    /**
     * Query helper matching the Supabase adapter's getDataFromQuery signature.
     * Runs a vector similarity search and returns the scored result set.
     * @param client The axios client from createClient().
     * @param collectionName Collection to search.
     * @param vector Query vector.
     * @param args Extra search options (limit, filter, withPayload, withVector, scoreThreshold).
     * @returns Array of scored points from the Qdrant API result.
     */
    async getDataFromQuery({ client, collectionName, vector, ...args }: GetDataFromQueryArgs): Promise<any> {
        return this.search({ client, collectionName, vector, ...args });
    }

    /**
     * Retrieve a single point by id.
     * @param client The axios client from createClient().
     * @param collectionName Collection name.
     * @param id Point id.
     * @returns The Qdrant point result.
     */
    async getDataById({ client, collectionName, id }: PointArgs): Promise<any> {
        return this.runWithRetry(async () => {
            const res = await client.get(`/collections/${collectionName}/points/${id}`);
            return res.data?.result;
        });
    }

    /**
     * Update a point's payload by id (merge update via Qdrant's set_payload).
     * @param client The axios client from createClient().
     * @param collectionName Collection name.
     * @param id Point id.
     * @param payload Payload fields to set.
     * @returns The Qdrant API response.
     */
    async updateById({ client, collectionName, id, payload }: PointArgs & { payload: Record<string, any> }): Promise<any> {
        return this.runWithRetry(async () => {
            const res = await client.post(`/collections/${collectionName}/points/payload`, {
                payload,
                points: [id],
            });
            return res.data;
        });
    }

    /**
     * Delete points by ids, or by a filter.
     * @param client The axios client from createClient().
     * @param collectionName Collection name.
     * @param ids Point ids to delete (optional when filter is given).
     * @param filter Qdrant filter selecting points to delete (optional when ids given).
     * @param wait Wait for the operation to finish (default true).
     * @returns The Qdrant API response.
     */
    async deleteById({ client, collectionName, ids, filter, wait = true }: DeleteArgs): Promise<any> {
        return this.runWithRetry(async () => {
            const res = await client.post(
                `/collections/${collectionName}/points/delete`,
                {
                    ...(ids ? { points: ids } : {}),
                    ...(filter ? { filter } : {}),
                },
                { params: { wait } }
            );
            return res.data;
        });
    }

    /**
     * Scroll through points in a collection (list/paginate without a query vector).
     * @param client The axios client from createClient().
     * @param collectionName Collection name.
     * @param args Scroll options: limit, offset, filter, withPayload, withVector.
     * @returns The Qdrant scroll result (points + next page offset).
     */
    async scroll({ client, collectionName, ...args }: ArgsObject & { client: AxiosInstance; collectionName: string }): Promise<any> {
        return this.runWithRetry(async () => {
            const res = await client.post(`/collections/${collectionName}/points/scroll`, args);
            return res.data?.result;
        });
    }
}

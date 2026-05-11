import { config } from "dotenv";
config();

interface ArgsObject {
    [key: string]: any;
}

interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: ArgsObject;
}

interface QdrantFilter {
    [key: string]: any;
}

interface InsertVectorDataArgs {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

interface SearchVectorDataArgs {
    collectionName: string;
    vector: number[] | Record<string, number[]>;
    limit?: number;
    filter?: QdrantFilter;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
    scoreThreshold?: number;
}

interface GetDataArgs {
    collectionName: string;
    ids: Array<string | number>;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
}

interface DeleteByIdArgs {
    collectionName: string;
    ids: Array<string | number>;
    wait?: boolean;
}

interface UpdateByIdArgs {
    collectionName: string;
    id: string | number;
    payload: ArgsObject;
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    private async request(path: string, options: RequestInit = {}): Promise<any> {
        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required to connect to Qdrant");
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(options.headers as Record<string, string>),
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        const response = await fetch(`${this.QDRANT_URL}${path}`, {
            ...options,
            headers,
        });

        const text = await response.text();
        const body = text ? JSON.parse(text) : {};

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with status ${response.status}: ${JSON.stringify(body)}`
            );
        }

        return body.result ?? body;
    }

    /**
     * Create a Qdrant collection.
     * @param collectionName The Qdrant collection name.
     * @param vectors Qdrant vector configuration, for example { size: 1536, distance: "Cosine" }.
     * @returns The Qdrant API result.
     */
    async createCollection({
        collectionName,
        vectors,
    }: {
        collectionName: string;
        vectors: ArgsObject;
    }): Promise<any> {
        return this.request(`/collections/${collectionName}`, {
            method: "PUT",
            body: JSON.stringify({ vectors }),
        });
    }

    /**
     * Insert or update vector points in a Qdrant collection.
     * @param collectionName The Qdrant collection name.
     * @param points Points to upsert with id, vector and optional payload.
     * @param wait Whether to wait for the operation to complete.
     * @returns The Qdrant API result.
     */
    async insertVectorData({
        collectionName,
        points,
        wait = true,
    }: InsertVectorDataArgs): Promise<any> {
        return this.request(`/collections/${collectionName}/points?wait=${wait}`, {
            method: "PUT",
            body: JSON.stringify({ points }),
        });
    }

    /**
     * Search vector points in a Qdrant collection.
     * @param collectionName The Qdrant collection name.
     * @param vector Query vector.
     * @param limit Maximum number of matches to return.
     * @param filter Optional Qdrant filter object.
     * @param withPayload Include payload in results.
     * @param withVector Include vectors in results.
     * @param scoreThreshold Optional minimum similarity score.
     * @returns Matching Qdrant points.
     */
    async getDataFromQuery({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: SearchVectorDataArgs): Promise<any> {
        return this.request(`/collections/${collectionName}/points/search`, {
            method: "POST",
            body: JSON.stringify({
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
                score_threshold: scoreThreshold,
            }),
        });
    }

    /**
     * Fetch points from a Qdrant collection by id.
     * @param collectionName The Qdrant collection name.
     * @param ids Point ids to retrieve.
     * @param withPayload Include payload in results.
     * @param withVector Include vectors in results.
     * @returns Requested Qdrant points.
     */
    async getData({ collectionName, ids, withPayload = true, withVector = false }: GetDataArgs) {
        return this.request(`/collections/${collectionName}/points`, {
            method: "POST",
            body: JSON.stringify({
                ids,
                with_payload: withPayload,
                with_vector: withVector,
            }),
        });
    }

    /**
     * Fetch a single Qdrant point by id.
     * @param collectionName The Qdrant collection name.
     * @param id Point id.
     * @returns The requested Qdrant point.
     */
    async getDataById({
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        id: string | number;
        withPayload?: boolean | string[];
        withVector?: boolean | string[];
    }): Promise<any> {
        return this.request(
            `/collections/${collectionName}/points/${id}?with_payload=${withPayload}&with_vector=${withVector}`
        );
    }

    /**
     * Set payload fields for one Qdrant point.
     * @param collectionName The Qdrant collection name.
     * @param id Point id.
     * @param payload Payload fields to set.
     * @param wait Whether to wait for the operation to complete.
     * @returns The Qdrant API result.
     */
    async updateById({ collectionName, id, payload, wait = true }: UpdateByIdArgs): Promise<any> {
        return this.request(`/collections/${collectionName}/points/payload?wait=${wait}`, {
            method: "POST",
            body: JSON.stringify({
                payload,
                points: [id],
            }),
        });
    }

    /**
     * Delete points from a Qdrant collection by id.
     * @param collectionName The Qdrant collection name.
     * @param ids Point ids to delete.
     * @param wait Whether to wait for the operation to complete.
     * @returns The Qdrant API result.
     */
    async deleteById({ collectionName, ids, wait = true }: DeleteByIdArgs): Promise<any> {
        return this.request(`/collections/${collectionName}/points/delete?wait=${wait}`, {
            method: "POST",
            body: JSON.stringify({
                points: ids,
            }),
        });
    }
}

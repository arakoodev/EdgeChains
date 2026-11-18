import { config } from "dotenv";
config();

type QdrantPointId = string | number;
type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

interface ArgsObject {
    [key: string]: any;
}

interface QdrantClient {
    request<T>(method: string, path: string, body?: ArgsObject): Promise<T>;
}

interface QdrantClientArgs {
    client?: QdrantClient;
}

interface CollectionArgs extends QdrantClientArgs {
    collectionName?: string;
}

interface CreateCollectionArgs extends CollectionArgs {
    vectorSize: number;
    distance?: QdrantDistance;
}

interface InsertVectorDataArgs extends CollectionArgs {
    id: QdrantPointId;
    vector: number[];
    payload?: ArgsObject;
    wait?: boolean;
}

interface GetDataFromQueryArgs extends CollectionArgs {
    vector: number[];
    limit?: number;
    filter?: ArgsObject;
    withPayload?: boolean | string[] | ArgsObject;
    withVector?: boolean | string[];
    scoreThreshold?: number;
}

interface GetDataArgs extends CollectionArgs {
    limit?: number;
    offset?: QdrantPointId;
    filter?: ArgsObject;
    withPayload?: boolean | string[] | ArgsObject;
    withVector?: boolean | string[];
}

interface GetDataByIdArgs extends CollectionArgs {
    id: QdrantPointId;
    withPayload?: boolean | string[] | ArgsObject;
    withVector?: boolean | string[];
}

interface UpdateByIdArgs extends CollectionArgs {
    id: QdrantPointId;
    updatedContent: ArgsObject;
    wait?: boolean;
}

interface DeleteByIdArgs extends CollectionArgs {
    id: QdrantPointId;
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;
    COLLECTION_NAME: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string, COLLECTION_NAME?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
        this.COLLECTION_NAME = COLLECTION_NAME || process.env.QDRANT_COLLECTION_NAME || "";
    }

    createClient(): QdrantClient {
        return {
            request: this.request.bind(this),
        };
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
        return this.getClient(client).request(
            "PUT",
            `/collections/${this.getCollectionName(collectionName)}`,
            {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            }
        );
    }

    async insertVectorData({
        client,
        collectionName,
        id,
        vector,
        payload = {},
        wait = true,
    }: InsertVectorDataArgs): Promise<any> {
        return this.getClient(client).request(
            "PUT",
            `/collections/${this.getCollectionName(collectionName)}/points?wait=${wait}`,
            {
                points: [
                    {
                        id,
                        vector,
                        payload,
                    },
                ],
            }
        );
    }

    async getDataFromQuery({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: GetDataFromQueryArgs): Promise<any> {
        return this.getClient(client).request(
            "POST",
            `/collections/${this.getCollectionName(collectionName)}/points/search`,
            {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
                score_threshold: scoreThreshold,
            }
        );
    }

    async getData({
        client,
        collectionName,
        limit = 10,
        offset,
        filter,
        withPayload = true,
        withVector = false,
    }: GetDataArgs): Promise<any> {
        return this.getClient(client).request(
            "POST",
            `/collections/${this.getCollectionName(collectionName)}/points/scroll`,
            {
                limit,
                offset,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            }
        );
    }

    async getDataById({
        client,
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: GetDataByIdArgs): Promise<any> {
        const params = new URLSearchParams({
            with_payload: JSON.stringify(withPayload),
            with_vector: JSON.stringify(withVector),
        });

        return this.getClient(client).request(
            "GET",
            `/collections/${this.getCollectionName(collectionName)}/points/${encodeURIComponent(
                String(id)
            )}?${params.toString()}`
        );
    }

    async updateById({
        client,
        collectionName,
        id,
        updatedContent,
        wait = true,
    }: UpdateByIdArgs): Promise<any> {
        return this.getClient(client).request(
            "POST",
            `/collections/${this.getCollectionName(collectionName)}/points/payload?wait=${wait}`,
            {
                payload: updatedContent,
                points: [id],
            }
        );
    }

    async deleteById({
        client,
        collectionName,
        id,
        wait = true,
    }: DeleteByIdArgs): Promise<any> {
        return this.getClient(client).request(
            "POST",
            `/collections/${this.getCollectionName(collectionName)}/points/delete?wait=${wait}`,
            {
                points: [id],
            }
        );
    }

    private getClient(client?: QdrantClient): QdrantClient {
        return client || this.createClient();
    }

    private getCollectionName(collectionName?: string): string {
        const name = collectionName || this.COLLECTION_NAME;
        if (!name) {
            throw new Error("Qdrant collectionName is required");
        }
        return encodeURIComponent(name);
    }

    private async request<T>(method: string, path: string, body?: ArgsObject): Promise<T> {
        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required");
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        const response = await fetch(`${this.QDRANT_URL}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(this.removeUndefined(body)) : undefined,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Qdrant request failed with ${response.status}: ${errorText}`);
        }

        if (response.status === 204) {
            return null as T;
        }

        return (await response.json()) as T;
    }

    private removeUndefined(value: ArgsObject): ArgsObject {
        return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
    }
}


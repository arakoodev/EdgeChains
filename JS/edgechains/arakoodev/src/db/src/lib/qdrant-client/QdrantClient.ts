export interface QdrantVectorPoint {
    id: number | string;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantSearchOptions {
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    with_payload?: boolean;
    with_vector?: boolean;
}

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    DOT = "Dot",
    EUCLID = "Euclid"
}

export class QdrantClient {
    url: string;
    apiKey?: string;

    constructor(url: string, apiKey?: string) {
        this.url = url.replace(/\/$/, "");
        this.apiKey = apiKey;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json"
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }
        return headers;
    }

    async createCollection(
        collectionName: string,
        vectorSize: number,
        distance: QdrantDistanceMetric = QdrantDistanceMetric.COSINE
    ): Promise<any> {
        const endpoint = `${this.url}/collections/${collectionName}`;
        const body = {
            vectors: {
                size: vectorSize,
                distance: distance
            }
        };
        const response = await fetch(endpoint, {
            method: "PUT",
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Qdrant createCollection failed (${response.status}): ${errorText}`);
        }
        return await response.json();
    }

    async upsertPoints(collectionName: string, points: QdrantVectorPoint[]): Promise<any> {
        const endpoint = `${this.url}/collections/${collectionName}/points`;
        const body = { points };
        const response = await fetch(endpoint, {
            method: "PUT",
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Qdrant upsertPoints failed (${response.status}): ${errorText}`);
        }
        return await response.json();
    }

    async search(collectionName: string, options: QdrantSearchOptions): Promise<any> {
        const endpoint = `${this.url}/collections/${collectionName}/points/search`;
        const body = {
            vector: options.vector,
            limit: options.limit ?? 10,
            filter: options.filter,
            with_payload: options.with_payload ?? true,
            with_vector: options.with_vector ?? false
        };
        const response = await fetch(endpoint, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Qdrant search failed (${response.status}): ${errorText}`);
        }
        return await response.json();
    }

    async scroll(
        collectionName: string,
        limit: number = 10,
        filter?: Record<string, any>
    ): Promise<any> {
        const endpoint = `${this.url}/collections/${collectionName}/points/scroll`;
        const body = {
            limit,
            filter,
            with_payload: true,
            with_vector: false
        };
        const response = await fetch(endpoint, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Qdrant scroll failed (${response.status}): ${errorText}`);
        }
        return await response.json();
    }

    async deletePoints(collectionName: string, points: (number | string)[]): Promise<any> {
        const endpoint = `${this.url}/collections/${collectionName}/points/delete`;
        const body = { points };
        const response = await fetch(endpoint, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Qdrant deletePoints failed (${response.status}): ${errorText}`);
        }
        return await response.json();
    }
}

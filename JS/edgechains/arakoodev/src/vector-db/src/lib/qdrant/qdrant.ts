import retry from "retry";

export class QdrantVectorClient {
    readonly url: string;
    readonly apiKey?: string;

    constructor(url: string, apiKey?: string) {
        this.url = (url || process.env.QDRANT_URL || 'http://localhost:6333').replace(/\/$/, '');
        this.apiKey = apiKey || process.env.QDRANT_API_KEY;
    }

    private headers(): Record<string, string> {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.apiKey) h['api-key'] = this.apiKey;
        return h;
    }

    async insertVectorData({ collectionName, points }: { collectionName: string; points: any[] }): Promise<any> {
        const res = await fetch(`${this.url}/collections/${collectionName}/points?wait=true`, {
            method: 'PUT',
            headers: this.headers(),
            body: JSON.stringify({ points }),
        });
        if (!res.ok) throw new Error(`Qdrant insert failed: ${res.statusText}`);
        return res.json();
    }

    async searchVectors({ collectionName, vector, limit = 5, filter }: { collectionName: string; vector: number[]; limit?: number; filter?: any }): Promise<any> {
        const res = await fetch(`${this.url}/collections/${collectionName}/points/search`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ vector, limit, filter, with_payload: true }),
        });
        if (!res.ok) throw new Error(`Qdrant search failed: ${res.statusText}`);
        return res.json();
    }

    async getDataById({ collectionName, ids }: { collectionName: string; ids: (string | number)[] }): Promise<any> {
        const res = await fetch(`${this.url}/collections/${collectionName}/points`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ ids, with_payload: true, with_vector: true }),
        });
        if (!res.ok) throw new Error(`Qdrant retrieve failed: ${res.statusText}`);
        return res.json();
    }

    async deleteById({ collectionName, points }: { collectionName: string; points: (string | number)[] }): Promise<any> {
        const res = await fetch(`${this.url}/collections/${collectionName}/points/delete?wait=true`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ points }),
        });
        if (!res.ok) throw new Error(`Qdrant delete failed: ${res.statusText}`);
        return res.json();
    }
}

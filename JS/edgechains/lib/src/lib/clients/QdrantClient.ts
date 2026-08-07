// QdrantClient.ts
// Wraps Qdrant API directly (no npm packages) following EdgeChains pattern

export interface QdrantConfig {
  url: string;  // e.g., http://localhost:6333
  apiKey?: string;
}

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, any>;
}

export class QdrantClient {
  private url: string;
  private apiKey?: string;
  private collectionName: string;

  constructor(config: QdrantConfig, collectionName: string = 'documents') {
    this.url = config.url.replace(/\/$/, '');  // Remove trailing slash
    this.apiKey = config.apiKey;
    this.collectionName = collectionName;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const headers: Record<string, string> = {'Content-Type': 'application/json'};
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }

    const response = await fetch(`${this.url}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Qdrant API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async upsert(points: QdrantPoint[]): Promise<void> {
    await this.request('PUT', `/collections/${this.collectionName}/points`, {
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload || {},
      })),
    });
  }

  async search(vector: number[], limit: number = 10): Promise<any[]> {
    const result = await this.request('POST', `/collections/${this.collectionName}/points/search`, {
      vector,
      limit,
      with_payload: true,
    });
    return result.result || [];
  }

  async delete(pointIds: (string | number)[]): Promise<void> {
    await this.request('POST', `/collections/${this.collectionName}/points/delete`, {
      points: pointIds,
    });
  }

  async getCollection(): Promise<any> {
    return this.request('GET', `/collections/${this.collectionName}`);
  }
}

// Export for use in EdgeChains services
export default QdrantClient;

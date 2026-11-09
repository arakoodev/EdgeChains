/**
 * Arakoo EdgeChains Algora Bounty #273 ($30.00 USD):
 * Qdrant Vector Database Client for the EdgeChains JavaScript SDK.
 *
 * Uses the Qdrant REST API directly without external @qdrant npm packages.
 */

export class Qdrant {
  constructor(qdrantUrl = "", apiKey = "", transport = null) {
    this.QDRANT_URL = (qdrantUrl || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/+$/, "");
    this.QDRANT_API_KEY = apiKey || process.env.QDRANT_API_KEY || "";
    this.transport = transport || this._defaultTransport.bind(this);
  }

  _headers() {
    const headers = { "Content-Type": "application/json" };
    if (this.QDRANT_API_KEY) {
      headers["api-key"] = this.QDRANT_API_KEY;
    }
    return headers;
  }

  async _defaultTransport(url, options) {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Qdrant HTTP ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }

  async createCollection({ collectionName, vectorSize, distance = "Cosine" }) {
    if (!collectionName) throw new Error("collectionName is required");
    const url = `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}`;
    return await this.transport(url, {
      method: "PUT",
      headers: this._headers(),
      body: JSON.stringify({
        vectors: { size: vectorSize, distance },
      }),
    });
  }

  async insertVectorData({ collectionName, points }) {
    if (!collectionName) throw new Error("collectionName is required");
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error("points must be a non-empty array");
    }
    const url = `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}/points?wait=true`;
    return await this.transport(url, {
      method: "PUT",
      headers: this._headers(),
      body: JSON.stringify({ points }),
    });
  }

  async getDataFromQuery({
    collectionName,
    vector,
    limit = 5,
    filter = undefined,
    withPayload = true,
    withVector = false,
  }) {
    if (!collectionName) throw new Error("collectionName is required");
    const url = `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}/points/search`;
    const res = await this.transport(url, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify({
        vector,
        limit,
        filter,
        with_payload: withPayload,
        with_vector: withVector,
      }),
    });
    return res.result || [];
  }

  async getDataById({ collectionName, ids, withPayload = true, withVector = false }) {
    if (!collectionName) throw new Error("collectionName is required");
    const url = `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}/points`;
    const res = await this.transport(url, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify({
        ids: Array.isArray(ids) ? ids : [ids],
        with_payload: withPayload,
        with_vector: withVector,
      }),
    });
    return res.result || [];
  }

  async deleteById({ collectionName, ids }) {
    if (!collectionName) throw new Error("collectionName is required");
    const url = `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}/points/delete?wait=true`;
    return await this.transport(url, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify({
        points: Array.isArray(ids) ? ids : [ids],
      }),
    });
  }
}

export default { Qdrant };

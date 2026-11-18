# 📦 Bounty: Add Qdrant Vector‑DB Support to the EdgeChains JavaScript SDK  

**Goal** – Extend the existing EdgeChains JS SDK (currently backed by Postgres/Supabase) so that developers can optionally use **Qdrant** as the vector store. The integration must be:

* **Feature‑complete** (upsert, delete, similarity‑search, batch operations).  
* **Type‑safe** (full TypeScript typings).  
* **Configurable** (runtime selection via SDK config or env vars).  
* **Backward‑compatible** (existing Postgres flows continue to work unchanged).  
* **Well‑tested** (unit + integration tests, CI).  
* **Documented** (README, JSDoc, example usage).

Below is a **step‑by‑step technical design** that you can hand‑off to a developer or use as a checklist for implementation.

---

## 1. High‑Level Architecture  

```
┌─────────────────────┐
│   EdgeChains SDK    │
│ (public API)        │
│  └─ VectorStore     │
│      ├─ Postgres    │   <-- Existing implementation
│      └─ Qdrant      │   <-- NEW
└─────────────────────┘
```

* **VectorStore** – an abstract interface (`IVectorStore`) that defines all required operations.  
* **PostgresClient** – concrete implementation already present.  
* **QdrantClient** – new implementation that conforms to the same interface.  
* **VectorStoreFactory** – a thin factory that decides which concrete client to instantiate based on SDK config (`store.type`).  

All higher‑level services (e.g., `HydeSearchService`) depend *only* on the `IVectorStore` abstraction, so they will work unchanged after the factory switch.

---

## 2. Define a Unified Interface (`IVectorStore`)

Create a new TypeScript file `src/lib/clients/IVectorStore.ts` (or extend the existing one if present).

```ts
// src/lib/clients/IVectorStore.ts
export interface VectorRecord<T = any> {
  /** Unique identifier for the vector (primary key) */
  id: string;
  /** The raw vector (float[]). May be omitted when only metadata is stored. */
  embedding?: number[];
  /** Optional payload / metadata that should travel with the vector */
  metadata?: T;
}

/**
 * Minimal contract that every vector‑store client must fulfil.
 * All methods return native JS Promise to allow async/await usage.
 */
export interface IVectorStore {
  /**
   * Insert or replace a single vector.
   */
  upsert(record: VectorRecord): Promise<void>;

  /**
   * Insert or replace many vectors in a single batch.
   */
  upsertMany(records: VectorRecord[]): Promise<void>;

  /**
   * Delete a vector by id.
   */
  delete(id: string): Promise<void>;

  /**
   * Delete many vectors at once.
   */
  deleteMany(ids: string[]): Promise<void>;

  /**
   * Perform a similarity search.
   *
   * @param embedding   Query vector.
   * @param topK        Number of results to return.
   * @param filter?     Optional metadata filter (key/value pairs).
   * @returns           Ordered list of matching records, each with distance.
   */
  search(
    embedding: number[],
    topK: number,
    filter?: Record<string, unknown>
  ): Promise<Array<{ record: VectorRecord; distance: number }>>;

  /**
   * Return total number of vectors stored.
   */
  count(): Promise<number>;

  /**
   * Close any underlying connections / clean resources.
   */
  disconnect(): Promise<void>;
}
```

*All existing Postgres client implementations will be updated to implement this interface (they already do, but we’ll add explicit `implements IVectorStore` for compile‑time safety).*

---

## 3. Add Qdrant Client Implementation  

### 3.1 Install Qdrant SDK

```bash
npm i @qdrant/js-client-rest   # official Qdrant HTTP client
# Optional: peer deps for types, fetch polyfill if needed
npm i -D @types/node-fetch
```

### 3.2 Create `QdrantClient.ts`

```ts
// src/lib/clients/QdrantClient.ts
import {
  QdrantClient as RestClient,
  Payload,
  PointStruct,
  Filter,
  Condition,
  Match,
  Range,
} from '@qdrant/js-client-rest';
import { IVectorStore, VectorRecord } from './IVectorStore';

export interface QdrantConfig {
  /** Base URL of Qdrant (e.g. http://localhost:6333) */
  url: string;
  /** Collection name – each SDK instance works with a single collection */
  collectionName: string;
  /** Optional API key for Cloud deployments */
  apiKey?: string;
  /** Dimension of embeddings – required when creating the collection */
  dimension: number;
}

/**
 * QdrantClient implements the IVectorStore contract using Qdrant's HTTP API.
 */
export class QdrantVectorStore implements IVectorStore {
  private client: RestClient;
  private collection: string;
  private dim: number;

  constructor(private cfg: QdrantConfig) {
    const { url, apiKey, collectionName, dimension } = cfg;
    this.client = new RestClient({ url, apiKey });
    this.collection = collectionName;
    this.dim = dimension;
  }

  /** --------------------------------------------------------------
   *  PRIVATE helpers
   * -------------------------------------------------------------- */
  private async ensureCollection(): Promise<void> {
    const exists = await this.client.getCollections()
      .then(res => res.collections?.some(c => c.name === this.collection));
    if (!exists) {
      await this.client.createCollection(this.collection, {
        vectors: { size: this.dim, distance: 'Cosine' }, // we default to Cosine
      });
    }
  }

  private toPayload<T>(metadata?: T): Payload | undefined {
    if (!metadata) return undefined;
    // Qdrant expects primitive JSON values, we shallow‑copy.
    return metadata as unknown as Payload;
  }

  /** --------------------------------------------------------------
   *  PUBLIC API (IVectorStore)
   * -------------------------------------------------------------- */
  async upsert(record: VectorRecord): Promise<void> {
    await this.ensureCollection();
    if (!record.embedding) {
      throw new Error('Qdrant upsert requires an embedding vector');
    }

    const point: PointStruct = {
      id: record.id,
      vector: record.embedding,
      payload: this.toPayload(record.metadata),
    };
    await this.client.upsert(this.collection, {
      points: [point],
    });
  }

  async upsertMany(records: VectorRecord[]): Promise<void> {
    await this.ensureCollection();
    const points: PointStruct[] = records.map(r => {
      if (!r.embedding) {
        throw new Error('All upsertMany records must contain an embedding');
      }
      return {
        id: r.id,
        vector: r.embedding,
        payload: this.toPayload(r.metadata),
      };
    });
    await this.client.upsert(this.collection, { points });
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.collection, {
      points: [id],
    });
  }

  async deleteMany(ids: string[]): Promise<void> {
    await this.client.delete(this.collection, {
      points: ids,
    });
  }

  async search(
    embedding: number[],
    topK: number,
    filter?: Record<string, unknown>
  ): Promise<Array<{ record: VectorRecord; distance: number }>> {
    await this.ensureCollection();

    const searchPayload: any = {
      vector: embedding,
      limit: topK,
      with_payload: true,
      with_vectors: false,
    };

    if (filter && Object.keys(filter).length > 0) {
      const conditions: Condition[] = Object.entries(filter).map(
        ([field, value]) => ({
          key: field,
          match: { value },
        } as Match)
      );
      searchPayload.filter = { must: conditions } as Filter;
    }

    const res = await this.client.search(this.collection, searchPayload);
    return res.map(hit => ({
      record: {
        id: hit.id as string,
        metadata: hit.payload as any,
      },
      distance: hit.score,
    }));
  }

  async count(): Promise<number> {
    const info = await this.client.getCollectionInfo(this.collection);
    return info?.vectors?.count ?? 0;
  }

  async disconnect(): Promise<void> {
    // Rest client is stateless; nothing to close.
    // Keep method for interface compliance.
  }
}
```

**Key points**

* **Lazy collection creation** – `ensureCollection` runs once per operation; safe for CI where the collection may not exist.  
* **Distance metric** – default to *Cosine* (the most common for embeddings). This can be made configurable later.  
* **Metadata filter** – Qdrant uses a **Filter** object; we map a flat key/value filter to a list of `Match` conditions (equality). Complex filters can be added later.  
* **Error handling** – surface meaningful errors (missing embedding, HTTP failures).  

---

## 4. Extend SDK Config & Factory  

### 4.1 SDK Configuration Interface

```ts
// src/lib/config/EdgeChainsConfig.ts
export interface EdgeChainsConfig {
  vectorStore: {
    /** "postgres" | "qdrant" (future providers) */
    type: 'postgres' | 'qdrant';
    /** Provider‑specific options (union type) */
    options: PostgresConfig | QdrantConfig;
  };
  // … other SDK options
}
```

### 4.2 VectorStoreFactory

Create/modify `src/lib/clients/VectorStoreFactory.ts`.

```ts
import { IVectorStore } from './IVectorStore';
import { PostgresClient } from './PostgresClient';
import { QdrantVectorStore, QdrantConfig } from './QdrantClient';
import { EdgeChainsConfig } from '../config/EdgeChainsConfig';

export class VectorStoreFactory {
  static create(cfg: EdgeChainsConfig): IVectorStore {
    const { type, options } = cfg.vectorStore;

    switch (type) {
      case 'postgres':
        return new PostgresClient(options as PostgresConfig);
      case 'qdrant':
        return new QdrantVectorStore(options as QdrantConfig);
      default:
        throw new Error(`Unsupported vector store type: ${type}`);
    }
  }
}
```

Higher‑level services will now instantiate the store via the factory:

```ts
// Example in HydeSearchService.ts (existing code)
import { VectorStoreFactory } from '../../lib/clients/VectorStoreFactory';
import { EdgeChainsConfig } from '../../lib/config/EdgeChainsConfig';

export class HydeSearchService {
  private vectorStore: IVectorStore;

  constructor(cfg: EdgeChainsConfig) {
    this.vectorStore = VectorStoreFactory.create(cfg);
  }

  // No changes required to the rest of the class.
}
```

---

## 5. Update Existing Postgres Client (type safety)

```ts
// src/lib/clients/PostgresClient.ts
import { IVectorStore, VectorRecord } from './IVectorStore';

export class PostgresClient implements IVectorStore {
  // existing implementation...
}
```

If the class already implements all required methods, simply add `implements IVectorStore` and adjust any return types to match the interface (e.g., `search` must return `{ record, distance }[]`).

---

## 6. Environment Variables & Convenience Helpers  

Add documentation and a helper to load config from `process.env`.

```ts
// src/lib/config/loadConfig.ts
import { EdgeChainsConfig } from './EdgeChainsConfig';

export function loadConfigFromEnv(): EdgeChainsConfig {
  const storeType = process.env.VECTOR_STORE_TYPE as 'postgres' | 'qdrant' ?? 'postgres';

  if (storeType === 'postgres') {
    return {
      vectorStore: {
        type: 'postgres',
        options: {
          connectionString: process.env.PG_CONNECTION_STRING!,
          // … other Postgres options
        },
      },
    };
  }

  // Qdrant
  return {
    vectorStore: {
      type: 'qdrant',
      options: {
        url: process.env.QDRANT_URL ?? 'http://localhost:6333',
        apiKey: process.env.QDRANT_API_KEY,
        collectionName: process.env.QDRANT_COLLECTION ?? 'edgechains',
        dimension: Number(process.env.VECTOR_DIMENSION ?? 1536),
      },
    },
  };
}
```

Developers can now start the SDK with:

```bash
VECTOR_STORE_TYPE=qdrant \
QDRANT_URL=http://localhost:6333 \
QDRANT_COLLECTION=documents \
VECTOR_DIMENSION=768 \
node myApp.js
```

---

## 7. Testing Strategy  

### 7.1 Unit Tests (Jest)

* **Mock the Qdrant REST client** using `jest.mock('@qdrant/js-client-rest')`. Verify that each method (`upsert`, `search`, etc.) calls the expected HTTP endpoints with correct payloads.  
* Keep existing Postgres unit tests unchanged.

File: `tests/clients/QdrantClient.test.ts`

```ts
import { QdrantVectorStore } from '../../src/lib/clients/QdrantClient';
import { RestClient } from '@qdrant/js-client-rest';

jest.mock('@qdrant/js-client-rest');

const MockRest = RestClient as jest.MockedClass<typeof RestClient>;

describe('QdrantVectorStore', () => {
  const cfg = {
    url: 'http://localhost:6333',
    collectionName
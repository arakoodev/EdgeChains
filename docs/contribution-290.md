# Bounty: Integrate AWS Comprehend as a Utility to Redact PII Data  
**Target repository:** `https://github.com/arakoodev/EdgeChains/tree/ts/JS/edgechains`  
**Scope:** JavaScript SDK only (v3) – no TypeScript build‑time dependencies required for the consumer, but the library itself can be written in TypeScript and compiled to plain JS.

---

## Table of Contents
1. [Overview](#overview)  
2. [Design Goals & Constraints](#design-goals--constraints)  
3. [Architecture Diagram](#architecture-diagram)  
4. [AWS Comprehend API Primer](#aws‑comprehend-api-primer)  
5. [Package Layout](#package-layout)  
6. [Implementation Details]  
   - 6.1 [AWS SDK Client Wrapper](#aws-sdk-client-wrapper)  
   - 6.2 [PII Detection & Redaction Core](#pii-detection--redaction-core)  
   - 6.3 [Streaming & Chunking Support](#streaming--chunking-support)  
   - 6.4 [Configuration & Credential Management](#configuration--credential-management)  
   - 6.5 [Error Handling & Retries](#error-handling--retries)  
   - 6.6 [Public API surface](#public-api-surface)  
7. [Usage Examples](#usage-examples)  
8. [Testing Strategy](#testing-strategy)  
9. [CI / Release Pipeline](#ci--release-pipeline)  
10. [Documentation Additions](#documentation-additions)  
11. [Security & Compliance Checklist](#security--compliance-checklist)  
12. [Future Extensions](#future-extensions)  
13. [Implementation Timeline (optional)]  

---

## 1. Overview <a name="overview"></a>

EdgeChains is a collection of “edge‑ready” utilities that can be chained together in server‑less environments (Cloudflare Workers, Vercel Edge Functions, AWS Lambda@Edge, etc.).  
The bounty asks to **expose a utility that redacts personally‑identifiable information (PII) from a free‑form text using AWS Comprehend**.

The utility must:

* Accept a plain string (or a `ReadableStream` for large payloads).  
* Call **AWS Comprehend – DetectPiiEntities** (or **StartPiiEntitiesDetectionJob** for batch).  
* Replace each detected entity with a mask (`***` or configurable placeholder).  
* Return the redacted string (or a stream).  
* Be **pure JavaScript** for consumers – the compiled output should be usable in any Node.js 18+ or edge runtime that supports the AWS SDK v3.

---

## 2. Design Goals & Constraints <a name="design-goals--constraints"></a>

| Goal | Reason |
|------|--------|
| **Zero runtime dependencies** beyond AWS SDK v3 (already a peer‑dependency of EdgeChains). | Keeps bundle size low for edge deployments. |
| **Configurable redaction mask** (`***`, `[REDACTED]`, custom function). | Different downstream systems need different conventions. |
| **Graceful degradation** when AWS credentials are missing – return input unchanged with a warning. | Allows local testing without AWS access. |
| **Streaming support** for payloads > 5 KB (Comprehend limit per request). | Edge functions often receive larger bodies (e.g., chat transcripts). |
| **Idempotent & deterministic** – same input yields same output (important for caching). | Enables use in memoized pipelines. |
| **Built‑in retry** with exponential back‑off (max 3 attempts). | Handles transient throttling. |
| **TypeScript source** compiled to a single `dist/comprehendRedact.js` (CommonJS & ESM). | Keeps source quality while providing plain JS for consumers. |
| **Full test coverage** (unit + integration mock). | Guarantees correctness and protects against regressions. |

---

## 3. Architecture Diagram <a name="architecture-diagram"></a>

```
+-------------------+          +---------------------------+          +-------------------+
|   EdgeChains      |  call    |   comprehendRedact()      |  uses    |   AWS SDK v3      |
|   (consumer)      |--------->|   (core utility)          |--------->|   ComprehendClient|
+-------------------+          +---------------------------+          +-------------------+
                                   |   ^   |
                                   |   |   | (optional streaming)
                                   v   |   v
                        +---------------------------+
                        |  DetectPiiEntities API    |
                        +---------------------------+
                                   |
                                   v
                         +-------------------+
                         | Redaction Engine |
                         +-------------------+
                                   |
                                   v
                         +-------------------+
                         | Redacted text/   |
                         |  stream output    |
                         +-------------------+
```

---

## 4. AWS Comprehend API Primer <a name="aws‑comprehend-api-primer"></a>

| Endpoint | Limits | Response |
|----------|--------|----------|
| `DetectPiiEntities` (synchronous) | **5 KB** per request (UTF‑8). | List of `{ BeginOffset, EndOffset, Score, Type }`. |
| `StartPiiEntitiesDetectionJob` (asynchronous) | Up to 100 MB per document (via S3). | Not needed for edge; we’ll chunk >5 KB and call sync API repeatedly. |

**Why we use `DetectPiiEntities`**  
* Instant response – perfect for edge latency requirements.  
* Simpler code path – no job polling.  

**Chunking strategy**  
1. If payload ≤ 5 KB → single call.  
2. Else → split on paragraph boundaries (or whitespace) while preserving entity offsets.  
3. Process each chunk independently and stitch results together.

---

## 5. Package Layout <a name="package-layout"></a>

```
edgechains/
├─ src/
│  ├─ comprehend/
│  │   ├─ client.ts               // thin wrapper around AWS SDK client
│  │   ├─ redact.ts                // core detection + redaction logic
│  │   ├─ stream.ts                // utilities for streaming/chunking
│  │   └─ index.ts                 // public export
│  └─ index.ts                     // existing EdgeChains barrel
├─ test/
│  ├─ comprehend/
│  │   ├─ redact.test.js
│  │   └─ stream.test.js
│  └─ ... (other existing tests)
├─ dist/
│  └─ comprehendRedact.js           // compiled output (CommonJS+ESM)
├─ package.json
├─ tsconfig.json
└─ README.md (updated)
```

*All source files are written in TypeScript for type safety, but the published `dist/` folder contains plain JavaScript only.*

---

## 6. Implementation Details <a name="implementation-details"></a>

### 6.1 AWS SDK Client Wrapper <a name="aws-sdk-client-wrapper"></a>

```ts
// src/comprehend/client.ts
import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
  DetectPiiEntitiesCommandInput,
  DetectPiiEntitiesCommandOutput,
} from '@aws-sdk/client-comprehend';
import { fromEnv, fromIni, fromCredentials } from '@aws-sdk/credential-providers';
import { RetryStrategy, StandardRetryStrategy } from '@aws-sdk/util-retry';

export interface ComprehendOptions {
  /** AWS region – required */
  region: string;
  /** Optional custom credentials – useful for testing */
  credentials?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
  /** Max number of retry attempts (default 3) */
  maxRetries?: number;
  /** Optional endpoint override (e.g., localstack) */
  endpoint?: string;
}

/**
 * Returns a ready‑to‑use ComprehendClient.
 * If no credentials are found, the client is still created but every call will throw
 * a `CredentialsProviderError`. The wrapper around `detectPii` will catch that.
 */
export function createComprehendClient(opts: ComprehendOptions): ComprehendClient {
  const { region, credentials, maxRetries = 3, endpoint } = opts;

  const clientConfig: any = {
    region,
    maxAttempts: maxRetries,
    retryStrategy: new StandardRetryStrategy(() => Promise.resolve(maxRetries)),
  };

  if (credentials) {
    clientConfig.credentials = credentials;
  } else {
    // default credential chain – env vars, shared config, EC2/ECS metadata
    clientConfig.credentials = fromEnv();
  }

  if (endpoint) clientConfig.endpoint = endpoint;

  return new ComprehendClient(clientConfig);
}

/**
 * Thin wrapper that returns the raw DetectPiiEntities output.
 * Errors are propagated unchanged – the calling layer decides how to handle them.
 */
export async function detectPii(
  client: ComprehendClient,
  text: string,
  languageCode: 'en' | 'es' | 'fr' | 'de' | 'it' = 'en'
): Promise<DetectPiiEntitiesCommandOutput> {
  const input: DetectPiiEntitiesCommandInput = {
    Text: text,
    LanguageCode: languageCode,
  };
  const command = new DetectPiiEntitiesCommand(input);
  return client.send(command);
}
```

*Key points*  
* Uses **StandardRetryStrategy** with configurable attempts.  
* Accepts optional explicit credentials for unit‑test mocking.  
* Keeps the client creation isolated – can be reused across many calls (important for edge cold‑starts).  

---

### 6.2 PII Detection & Redaction Core <a name="pii-detection--redaction-core"></a>

```ts
// src/comprehend/redact.ts
import { detectPii, createComprehendClient, ComprehendOptions } from './client';

export interface RedactOptions {
  /** AWS region – mandatory */
  region: string;
  /** Language of the input text (default: 'en') */
  languageCode?: 'en' | 'es' | 'fr' | 'de' | 'it';
  /** Placeholder that replaces each PII span (default: '***') */
  mask?: string | ((entity: PiiEntity) => string);
  /** Max size in bytes for a single DetectPiiEntities call (hard‑coded 5 KB). */
  maxChunkSize?: number;
  /** Custom client – for testing or advanced use‑cases */
  client?: ReturnType<typeof createComprehendClient>;
}

/** Minimal representation of a PII entity from Comprehend */
export interface PiiEntity {
  BeginOffset: number;
  EndOffset: number;
  Score: number;
  Type: string;
}

/**
 * Redacts PII from a plain string.
 *
 * @param input – the raw text to be processed.
 * @param opts  – configuration.
 * @returns the redacted string.
 */
export async function redactPii(input: string, opts: RedactOptions): Promise<string> {
  const {
    region,
    languageCode = 'en',
    mask = '***',
    maxChunkSize = 5 * 1024, // 5 KB
    client,
  } = opts;

  // Fast‑path: if input is tiny we can skip the chunker.
  if (Buffer.byteLength(input, 'utf8') <= maxChunkSize) {
    return redactChunk(input, region, languageCode, mask, client);
  }

  // Otherwise, split into safe chunks.
  const chunks = splitIntoChunks(input, maxChunkSize);
  const redactedChunks = await Promise.all(
    chunks.map((c) => redactChunk(c, region, languageCode, mask, client))
  );
  return redactedChunks.join('');
}

/**
 * Helper that performs a single DetectPiiEntities call and applies the mask.
 */
async function redactChunk(
  text: string,
  region: string,
  languageCode: string,
  mask: string | ((entity: PiiEntity) => string),
  maybeClient?: ReturnType<typeof createComprehendClient>
): Promise<string> {
  // If credentials missing, just return original (the SDK will throw; we catch it)
  let client = maybeClient;
  if (!client) {
    client = createComprehendClient({ region });
  }

  try {
    const result = await detectPii(client, text, languageCode as any);
    const entities = (result.Entities ?? []) as PiiEntity[];
    if (entities.length === 0) return text; // nothing to redact

    // Sort by start offset to simplify replacement
    const sorted = [...entities].sort((a, b) => a.BeginOffset - b.BeginOffset);
    let redacted = '';
    let cursor = 0;

    for (const ent of sorted) {
      // copy the segment before the entity
      redacted += text.slice(cursor, ent.BeginOffset);
      // add mask
      const placeholder = typeof mask === 'function' ? mask(ent) : mask;
      redacted += placeholder;
      cursor = ent.EndOffset;
    }
    // trailing part
    redacted += text.slice(cursor);
    return redacted;
  } catch (e: any) {
    // If the error is due to missing credentials, log a warning and return original.
    if (e.name === 'CredentialsProviderError' || e.message?.includes('Missing credentials')) {
      console.warn('[EdgeChains] AWS Comprehend credentials not available – returning original text.');
      return text;
    }
    // For any other error, propagate – caller can decide to fallback.
    throw e;
  }
}

/**
 * Split a large string into ≤ maxChunkSize pieces while trying not to break words.
 * Returns an array of strings preserving original order.
 */
export function splitIntoChunks(text
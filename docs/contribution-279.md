# Bounty Solution  
**Add support for Google PaLM 2 API to the JavaScript/TypeScript EdgeChains SDK**  

---

## Table of Contents
1. [Overview](#overview)  
2. [Current SDK Structure](#current-sdk-structure)  
3. [Design Goals & Constraints](#design-goals--constraints)  
4. [High‑Level Architecture](#high‑level-architecture)  
5. [Implementation Steps]  
   - 5.1 [Add new endpoint module](#51-add-new-endpoint-module)  
   - 5.2 [Authentication handling](#52-authentication-handling)  
   - 5.3 [Request/Response models](#53-requestresponse-models)  
   - 5.4 [Public wrapper class – `GooglePalmClient`](#54-public-wrapper-class--googlepalmclient)  
   - 5.5 [Integration with existing `EndpointFactory`](#55-integration-with-existing-endpointfactory)  
   - 5.6 [Error handling & retry policy](#56-error-handling--retry-policy)  
   - 5.7 [Streaming support (optional but recommended)](#57-streaming-support-optional-but-recommended)  
   - 5.8 [Testing strategy](#58-testing-strategy)  
   - 5.9 [Documentation & examples](#59-documentation--examples)  
   - 5.10 [CI/CD & publishing](#510-cicd--publishing)  
6. [Detailed Code Walk‑through](#detailed-code-walk‑through)  
7. [Migration / Backward Compatibility](#migration--backward-compatibility)  
8. [Future Enhancements](#future-enhancements)  
9. [Checklist for Bounty Completion](#checklist-for-bounty-completion)  

---

## Overview <a name="overview"></a>

The EdgeChains JavaScript SDK currently ships only with an OpenAI endpoint implementation (`OpenAIEndpoint`).  
The bounty requires adding first‑class support for **Google PaLM 2** (Generative AI) via the **Vertex AI Generative Language API** (`https://generativelanguage.googleapis.com/v1beta2/models/{model}:generateText`).  

The solution must:

* Provide a clean, typed wrapper (`GooglePalmClient`) that mirrors the existing `OpenAIEndpoint` API surface (e.g., `createChatCompletion`, `createCompletion`, etc.).
* Work in **Node.js** (with `google-auth-library`) **and** in **browser** environments (via **OAuth2 access token** or **API‑Key**).
* Include full TypeScript typings for request/response payloads.
* Integrate with the SDK’s existing **EndpointFactory** and **EdgeChains** orchestration layer.
* Have unit tests, integration tests (mocked), and updated documentation.

---

## Current SDK Structure <a name="current-sdk-structure"></a>

```
src/
 └─ lib/
     └─ endpoints/
         ├─ abstractEndpoint.ts          // Base class with shared logic
         ├─ openaiEndpoint.ts            // OpenAI implementation
         └─ endpointFactory.ts           // Factory that returns the appropriate endpoint
```

* `abstractEndpoint.ts` defines common helpers: `post`, `get`, `handleError`, `retry`, etc.
* `openaiEndpoint.ts` extends `AbstractEndpoint` and implements:
  * `createCompletion`
  * `createChatCompletion`
  * `listModels`
  * etc.

All public SDK functions call the **Endpoint** returned by the factory, e.g.:

```ts
import { EndpointFactory } from "./endpoints";
const endpoint = EndpointFactory.getInstance("openai");
const resp = await endpoint.createChatCompletion(payload);
```

---

## Design Goals & Constraints <a name="design-goals--constraints"></a>

| Goal | Reason |
|------|--------|
| **API parity** with OpenAI endpoint | Allows existing SDK users to switch providers with minimal code changes. |
| **Zero breaking changes** for current users | Keep the same public interface; new provider is opt‑in. |
| **Typed** (TS) everywhere | Leverage existing typings in the repo. |
| **Node + Browser** support | EdgeChains is used in serverless edge functions and browsers. |
| **Configurable authentication** | Support both **API‑Key** and **OAuth2 (service‑account)** flows. |
| **Graceful fallback** when model is not supported (e.g., chat vs text) | Provide helpful errors. |
| **Streaming (optional)** | PaLM2 supports streaming via `generateText` with `responseStream` flag – implement as a generator. |
| **Testing** with mocks (no real API calls) | CI must stay fast, no external credentials required. |
| **Documentation** updates and usage examples | Must be visible to reviewers. |

---

## High‑Level Architecture <a name="high-level-architecture"></a>

```
+--------------------+          +-----------------------+
|  EdgeChains SDK    |          |  Google Palm2 Client |
| (EndpointFactory) |--------->|  GooglePalmEndpoint   |
+--------------------+   API    +-----------------------+
        ^                                 ^
        |                                 |
   Existing          New Provider Interface (IEndpoint)
   OpenAIEndpoint    implements IEndpoint
   (unchanged)      implements IEndpoint
```

* **`IEndpoint`** – New TypeScript interface defining all supported methods (`createCompletion`, `createChatCompletion`, `listModels`, etc.).  
* **`GooglePalmEndpoint`** – Concrete class that implements `IEndpoint`. It delegates to a **`GooglePalmClient`** (thin wrapper around HTTP calls).  
* **`GooglePalmClient`** – Handles auth, request building, streaming, error parsing.  
* **`EndpointFactory`** – Updated to recognise `"google-palm"` (or `"palm"`).  

---

## Implementation Steps <a name="implementation-steps"></a>

### 5.1 Add new endpoint module <a name="51-add-new-endpoint-module"></a>

Create **`src/lib/endpoints/googlePalmEndpoint.ts`**.

* Extend `AbstractEndpoint`.
* Implement all required methods, delegating to `GooglePalmClient`.

### 5.2 Authentication handling <a name="52-authentication-handling"></a>

**Two supported flows**:

| Flow | When to use | Implementation |
|------|-------------|----------------|
| **API‑Key** | Simple client‑side usage, public demo | Pass key in query string: `?key=YOUR_API_KEY`. |
| **OAuth2 Service Account** | Server‑side / Cloud Functions | Use `google-auth-library` to obtain an access token (`https://www.googleapis.com/auth/cloud-platform`). |

Create **`src/lib/auth/googleAuth.ts`** exposing:

```ts
export interface GoogleAuthConfig {
  apiKey?: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
}
export class GoogleAuth {
  private token?: string;
  constructor(private cfg: GoogleAuthConfig) {}
  async getAccessToken(): Promise<string> { /* logic */ }
}
```

*In browser* we can also accept a pre‑generated token via config.

### 5.3 Request/Response models <a name="53-requestresponse-models"></a>

Add a **`src/lib/models/googlePalm.ts`** file that mirrors the official spec:

```ts
export interface GenerateTextRequest {
  model: string;                     // e.g. "text-bison-001"
  prompt: {
    text: string;
  };
  temperature?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  // streaming flag
  safetySettings?: SafetySetting[];
}
export interface GenerateTextResponse {
  candidates: {
    output: string;
    // optional token usage info
  }[];
  // ... other fields
}
```

Add typings for **chat** emulation (PaLM2 does not have a native chat endpoint, but we can simulate using `generateMessage` or `generateText` with a formatted prompt). Provide a helper `formatChatMessages(messages: ChatMessage[])`.

### 5.4 Public wrapper class – `GooglePalmClient` <a name="54-public-wrapper-class--googlepalmclient"></a>

File **`src/lib/clients/googlePalmClient.ts`**:

```ts
import fetch from "node-fetch";
import { GoogleAuth } from "../auth/googleAuth";
import { GenerateTextRequest, GenerateTextResponse } from "../models/googlePalm";

export class GooglePalmClient {
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta2";
  private readonly auth: GoogleAuth;
  private readonly defaultModel: string;

  constructor(
    private readonly config: {
      apiKey?: string;
      credentials?: any;
      model?: string;
      // optional fetch override for testing
      fetchImpl?: typeof fetch;
    }
  ) {
    this.auth = new GoogleAuth({
      apiKey: config.apiKey,
      credentials: config.credentials,
    });
    this.defaultModel = config.model ?? "text-bison-001";
    this.fetch = config.fetchImpl ?? fetch;
  }

  private fetch: typeof fetch;

  private async buildHeaders(): Promise<Record<string, string>> {
    const token = await this.auth.getAccessToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  private async request<T>(path: string, body: any, method = "POST"): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = await this.buildHeaders();
    const resp = await this.fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(
        `GooglePalm API error ${resp.status}: ${err || resp.statusText}`
      );
    }
    return (await resp.json()) as T;
  }

  // -----------------------------------------------------------------
  // Public API (mirrors OpenAIEndpoint)
  // -----------------------------------------------------------------
  async createCompletion(
    prompt: string,
    opts?: Partial<GenerateTextRequest>
  ): Promise<GenerateTextResponse> {
    const payload: GenerateTextRequest = {
      model: this.defaultModel,
      prompt: { text: prompt },
      ...opts,
    };
    return this.request<GenerateTextResponse>(
      `/models/${payload.model}:generateText`,
      payload
    );
  }

  // Chat‑style wrapper – converts messages array into a single prompt
  async createChatCompletion(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    opts?: Partial<GenerateTextRequest>
  ): Promise<GenerateTextResponse> {
    const prompt = this.formatChat(messages);
    return this.createCompletion(prompt, opts);
  }

  private formatChat(
    messages: { role: string; content: string }[]
  ): string {
    // Simple format: system + user/assistant alternating, separated by "\n"
    let out = "";
    for (const m of messages) {
      const prefix = m.role === "assistant" ? "Assistant:" : "User:";
      out += `${prefix} ${m.content}\n`;
    }
    return out.trim();
  }

  // Model listing – calls the generic "list models" endpoint
  async listModels(): Promise<{ models: { name: string }[] }> {
    return this.request("/models", {}, "GET");
  }

  // Streaming (experimental) – returns AsyncIterable<string>
  async *streamCompletion(
    prompt: string,
    opts?: Partial<GenerateTextRequest>
  ): AsyncIterable<string> {
    const payload: GenerateTextRequest = {
      model: this.defaultModel,
      prompt: { text: prompt },
      ...opts,
      // enable streaming – PaLM2 uses `responseStream: true`
      // (the field name may differ in later versions)
      // We'll send as query param `?alt=stream` if needed.
    };

    const url = `${this.baseUrl}/models/${payload.model}:generateText?alt=stream`;
    const headers = await this.buildHeaders();

    const resp = await this.fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Streaming error ${resp.status}: ${err}`);
    }

    // The streaming response is a series of JSON lines separated by '\n'
    const reader = resp.body?.getReader();
    if (!reader) {
      throw new Error("Streaming not supported in this environment");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          try {
            const chunk = JSON.parse(line) as GenerateTextResponse;
            // Emit each candidate's output (usually 1)
            for (const cand of chunk.candidates ?? []) {
              yield cand.output;
            }
          } catch (e) {
            // ignore malformed lines but log for debugging
            console.warn("Failed to parse streaming chunk:", line);
          }
        }
      }
    }
  }
}
```

**Key points**:

* **Auth** is abstracted; `GoogleAuth` will either return the API key as a bearer token (if `apiKey` is set) or a real OAuth2 token.
* **Error handling** surfaces HTTP errors as JavaScript `Error`.
* **Streaming** uses the `alt=stream` query parameter (as documented) and yields partial text chunks.

### 5.5 Integration with existing `EndpointFactory` <
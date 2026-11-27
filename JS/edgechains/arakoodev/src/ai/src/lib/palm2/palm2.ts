const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta3/models";

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
    fetchFn?: typeof fetch;
}

export interface Palm2GenerateTextOptions {
    prompt: string;
    model?: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    max_retry?: number;
    delay?: number;
}

export interface Palm2ChatMessage {
    author?: string;
    content: string;
}

export interface Palm2Example {
    input: Palm2ChatMessage;
    output: Palm2ChatMessage;
}

export interface Palm2ChatOptions {
    prompt?: string;
    messages?: Palm2ChatMessage[];
    context?: string;
    examples?: Palm2Example[];
    model?: string;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    max_retry?: number;
    delay?: number;
}

export interface Palm2EmbeddingOptions {
    text: string;
    model?: string;
    max_retry?: number;
    delay?: number;
}

export class Palm2AI {
    apiKey: string;
    baseUrl: string;
    private fetchFn: typeof fetch;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || process.env.GOOGLE_API_KEY || "";
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
    }

    private async requestWithRetry(
        url: string,
        body: string,
        maxAttempts: number = 3,
        delay: number = 200
    ): Promise<any> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await this.fetchFn(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body,
                });
                if (!response.ok) {
                    throw new Error(`PaLM 2 API HTTP ${response.status}: ${response.statusText}`);
                }
                return await response.json();
            } catch (err) {
                lastError = err;
                if (attempt < maxAttempts && delay > 0) {
                    await new Promise((r) => setTimeout(r, delay));
                }
            }
        }
        throw lastError;
    }

    /**
     * Generate text completions using PaLM 2 text-bison-001 (`:generateText`).
     */
    async generateText(options: Palm2GenerateTextOptions): Promise<any> {
        const model = options.model || "text-bison-001";
        const url = `${this.baseUrl}/${model}:generateText?key=${this.apiKey}`;

        const data = JSON.stringify({
            prompt: {
                text: options.prompt,
            },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
            ...(options.topP !== undefined ? { topP: options.topP } : {}),
            ...(options.topK !== undefined ? { topK: options.topK } : {}),
            ...(options.stopSequences ? { stopSequences: options.stopSequences } : {}),
        });

        return await this.requestWithRetry(url, data, options.max_retry || 3, options.delay || 200);
    }

    /**
     * Generate multi-turn chat responses using PaLM 2 chat-bison-001 (`:generateMessage`).
     */
    async chat(options: Palm2ChatOptions): Promise<any> {
        const model = options.model || "chat-bison-001";
        const url = `${this.baseUrl}/${model}:generateMessage?key=${this.apiKey}`;

        const messages: Palm2ChatMessage[] =
            options.messages && options.messages.length > 0
                ? options.messages
                : [{ author: "user", content: options.prompt || "" }];

        const data = JSON.stringify({
            prompt: {
                ...(options.context ? { context: options.context } : {}),
                ...(options.examples ? { examples: options.examples } : {}),
                messages,
            },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            ...(options.topP !== undefined ? { topP: options.topP } : {}),
            ...(options.topK !== undefined ? { topK: options.topK } : {}),
        });

        return await this.requestWithRetry(url, data, options.max_retry || 3, options.delay || 200);
    }

    /**
     * Generate text embeddings using PaLM 2 embedding-gecko-001 (`:embedText`).
     */
    async generateEmbeddings(options: Palm2EmbeddingOptions): Promise<number[]> {
        const model = options.model || "embedding-gecko-001";
        const url = `${this.baseUrl}/${model}:embedText?key=${this.apiKey}`;

        const data = JSON.stringify({
            text: options.text,
        });

        const response = await this.requestWithRetry(
            url,
            data,
            options.max_retry || 3,
            options.delay || 200
        );
        return response.embedding?.value || response;
    }
}

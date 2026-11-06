/**
 * Google PaLM 2 API Client for EdgeChains JavaScript/TypeScript SDK
 * Bounty: arakoodev/EdgeChains #279 ($25 USD)
 *
 * Zero-dependency REST adapter supporting PaLM 2 text generation (`models/text-bison-001:generateText`),
 * multi-turn chat (`models/chat-bison-001:generateMessage`), and embeddings (`models/embedding-gecko-001:embedText`)
 * with observable prompt chaining.
 */

export interface Palm2Config {
  apiKey: string;
  baseUrl?: string;
  textModel?: string;
  chatModel?: string;
  embeddingModel?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  fetchImpl?: typeof fetch;
}

export interface Palm2ChatMessage {
  author?: string;
  content: string;
}

export class GooglePalm2Client {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly textModel: string;
  private readonly chatModel: string;
  private readonly embeddingModel: string;
  private readonly temperature: number;
  private readonly maxOutputTokens: number;
  private readonly topP?: number;
  private readonly topK?: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: Palm2Config) {
    if (!config.apiKey) {
      throw new Error('GooglePalm2Client requires a valid Google Generative Language apiKey');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta2').replace(/\/+$/, '');
    this.textModel = config.textModel || 'models/text-bison-001';
    this.chatModel = config.chatModel || 'models/chat-bison-001';
    this.embeddingModel = config.embeddingModel || 'models/embedding-gecko-001';
    this.temperature = config.temperature ?? 0.2;
    this.maxOutputTokens = config.maxOutputTokens ?? 1024;
    this.topP = config.topP;
    this.topK = config.topK;
    this.fetchImpl = config.fetchImpl || globalThis.fetch;
  }

  private async request<T = Record<string, any>>(modelAndMethod: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}/${modelAndMethod}?key=${encodeURIComponent(this.apiKey)}`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { error?: { message?: string } })?.error?.message || `Google PaLM 2 API Error (${res.status})`
      );
    }
    return data as T;
  }

  async generateText(prompt: string, overrides: Partial<Palm2Config> = {}): Promise<{ output: string; candidates: any[] }> {
    const data = await this.request<{ candidates?: Array<{ output: string }> }>(
      `${overrides.textModel || this.textModel}:generateText`,
      {
        prompt: { text: prompt },
        temperature: overrides.temperature ?? this.temperature,
        maxOutputTokens: overrides.maxOutputTokens ?? this.maxOutputTokens,
        ...(this.topP !== undefined ? { topP: this.topP } : {}),
        ...(this.topK !== undefined ? { topK: this.topK } : {}),
      }
    );
    const candidates = data.candidates || [];
    return {
      output: candidates[0]?.output || '',
      candidates,
    };
  }

  async generateMessage(options: {
    context?: string;
    examples?: Array<{ input: { content: string }; output: { content: string } }>;
    messages: Palm2ChatMessage[];
    temperature?: number;
  }): Promise<{ reply: string; candidates: any[] }> {
    const data = await this.request<{ candidates?: Array<{ content: string; author?: string }> }>(
      `${this.chatModel}:generateMessage`,
      {
        prompt: {
          ...(options.context ? { context: options.context } : {}),
          ...(options.examples ? { examples: options.examples } : {}),
          messages: options.messages,
        },
        temperature: options.temperature ?? this.temperature,
      }
    );
    const candidates = data.candidates || [];
    return {
      reply: candidates[0]?.content || '',
      candidates,
    };
  }

  async embedText(text: string): Promise<number[]> {
    const data = await this.request<{ embedding?: { value?: number[] } }>(
      `${this.embeddingModel}:embedText`,
      { text }
    );
    return data.embedding?.value || [];
  }
}

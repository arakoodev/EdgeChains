import fs from 'fs';

export interface Palm2SafetySetting {
    category:
        | 'HARM_CATEGORY_DEROGATORY'
        | 'HARM_CATEGORY_TOXICITY'
        | 'HARM_CATEGORY_VIOLENCE'
        | 'HARM_CATEGORY_SEXUAL'
        | 'HARM_CATEGORY_MEDICAL'
        | 'HARM_CATEGORY_DANGEROUS';
    threshold: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
}

export interface Palm2GenerateTextOptions {
    prompt: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    stopSequences?: string[];
    safetySettings?: Palm2SafetySetting[];
}

export interface Palm2ChatMessage {
    author: string;
    content: string;
}

export interface Palm2GenerateMessageOptions {
    messages: Palm2ChatMessage[];
    context?: string;
    model?: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
}

export interface Palm2Candidate {
    output: string;
    safetyRatings?: Array<{ category: string; probability: string }>;
}

export interface Palm2TextResponse {
    candidates: Palm2Candidate[];
}

export interface Palm2EmbeddingResponse {
    embedding: {
        value: number[];
    };
}

export function loadPromptFromJsonnetFile(jsonnetPath: string, key = 'prompt'): string {
    const raw = fs.readFileSync(jsonnetPath, 'utf-8').trim();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed[key] !== 'string') {
        throw new Error(`Key "${key}" not found in Jsonnet prompt file ${jsonnetPath}`);
    }
    return parsed[key];
}

export class Palm2Endpoint {
    private apiKey: string;
    private baseUrl: string;
    private httpTransport?: (url: string, body: Record<string, any>) => Promise<any>;

    constructor(options: {
        apiKey?: string;
        baseUrl?: string;
        httpTransport?: (url: string, body: Record<string, any>) => Promise<any>;
    } = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || process.env.GOOGLE_API_KEY || '';
        this.baseUrl = (options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta2').replace(
            /\/+$/,
            ''
        );
        this.httpTransport = options.httpTransport;
    }

    async generateText(options: Palm2GenerateTextOptions): Promise<Palm2TextResponse> {
        const model = options.model || 'models/text-bison-001';
        const url = `${this.baseUrl}/${model}:generateText?key=${this.apiKey}`;
        const payload = {
            prompt: { text: options.prompt },
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 512,
            topP: options.topP ?? 0.95,
            topK: options.topK ?? 40,
            candidateCount: options.candidateCount ?? 1,
            stopSequences: options.stopSequences || [],
            safetySettings: options.safetySettings || [],
        };
        if (this.httpTransport) {
            return this.httpTransport(url, payload);
        }
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!resp.ok) {
            throw new Error(`PaLM 2 generateText failed with HTTP ${resp.status}`);
        }
        return (await resp.json()) as Palm2TextResponse;
    }

    async generateMessage(options: Palm2GenerateMessageOptions) {
        const model = options.model || 'models/chat-bison-001';
        const url = `${this.baseUrl}/${model}:generateMessage?key=${this.apiKey}`;
        const payload = {
            prompt: {
                context: options.context || '',
                messages: options.messages,
            },
            temperature: options.temperature ?? 0.5,
            topP: options.topP ?? 0.95,
            topK: options.topK ?? 40,
            candidateCount: options.candidateCount ?? 1,
        };
        if (this.httpTransport) {
            return this.httpTransport(url, payload);
        }
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!resp.ok) {
            throw new Error(`PaLM 2 generateMessage failed with HTTP ${resp.status}`);
        }
        return await resp.json();
    }

    async embedText(text: string, model = 'models/embedding-gecko-001'): Promise<Palm2EmbeddingResponse> {
        const url = `${this.baseUrl}/${model}:embedText?key=${this.apiKey}`;
        const payload = { text };
        if (this.httpTransport) {
            return this.httpTransport(url, payload);
        }
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!resp.ok) {
            throw new Error(`PaLM 2 embedText failed with HTTP ${resp.status}`);
        }
        return (await resp.json()) as Palm2EmbeddingResponse;
    }
}

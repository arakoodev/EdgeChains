import axios from "axios";

export interface Palm2Options {
    apiKey?: string;
    baseUrl?: string;
}

export interface Palm2TextOptions {
    prompt: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    stopSequences?: string[];
}

export interface Palm2Message {
    author?: string;
    content: string;
}

export interface Palm2ChatOptions {
    messages: Palm2Message[];
    context?: string;
    examples?: Array<{ input: Palm2Message; output: Palm2Message }>;
    model?: string;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
}

export interface Palm2Candidate {
    output?: string;
    author?: string;
    content?: string;
    safetyRatings?: Array<{ category: string; probability: string }>;
}

export interface Palm2Response {
    candidates: Palm2Candidate[];
    filters?: any[];
}

export class Palm2AI {
    apiKey: string;
    baseUrl: string;

    constructor(options: Palm2Options = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || "";
        this.baseUrl =
            options.baseUrl ||
            "https://generativelanguage.googleapis.com/v1beta2";
    }

    async generateText(options: Palm2TextOptions): Promise<Palm2Response> {
        const model = options.model || "text-bison-001";
        const url = `${this.baseUrl}/models/${model}:generateText?key=${this.apiKey}`;
        const payload = {
            prompt: { text: options.prompt },
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
            topP: options.topP ?? 0.95,
            topK: options.topK ?? 40,
            candidateCount: options.candidateCount ?? 1,
            ...(options.stopSequences ? { stopSequences: options.stopSequences } : {}),
        };
        const res = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" },
        });
        return res.data;
    }

    async chat(options: Palm2ChatOptions): Promise<Palm2Response> {
        const model = options.model || "chat-bison-001";
        const url = `${this.baseUrl}/models/${model}:generateMessage?key=${this.apiKey}`;
        const payload = {
            prompt: {
                ...(options.context ? { context: options.context } : {}),
                ...(options.examples ? { examples: options.examples } : {}),
                messages: options.messages,
            },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            topP: options.topP ?? 0.95,
            topK: options.topK ?? 40,
        };
        const res = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" },
        });
        return res.data;
    }

    async embedText(text: string, model = "embedding-gecko-001"): Promise<number[]> {
        const url = `${this.baseUrl}/models/${model}:embedText?key=${this.apiKey}`;
        const res = await axios.post(
            url,
            { text },
            { headers: { "Content-Type": "application/json" } }
        );
        return res.data?.embedding?.value ?? [];
    }
}

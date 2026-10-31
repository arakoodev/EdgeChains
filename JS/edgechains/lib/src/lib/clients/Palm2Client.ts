export interface Palm2ClientOptions {
    apiKey?: string;
    baseUrl?: string;
    textModel?: string;
    chatModel?: string;
    embeddingModel?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
}

export interface Palm2Message {
    author?: string;
    content: string;
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
}

export interface Palm2ChatOptions {
    messages: Palm2Message[];
    context?: string;
    examples?: Array<{ input: Palm2Message; output: Palm2Message }>;
    model?: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
}

export class Palm2Client {
    readonly apiKey: string;
    readonly baseUrl: string;
    readonly textModel: string;
    readonly chatModel: string;
    readonly embeddingModel: string;
    readonly temperature: number;
    readonly maxOutputTokens: number;
    readonly topP?: number;
    readonly topK?: number;

    constructor(options: Palm2ClientOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || "";
        const defaultBase = "https://generativelanguage.googleapis.com/v1beta2";
        this.baseUrl = (options.baseUrl || defaultBase).replace(/\/+$/, "");
        this.textModel = options.textModel || "models/text-bison-001";
        this.chatModel = options.chatModel || "models/chat-bison-001";
        this.embeddingModel = options.embeddingModel || "models/embedding-gecko-001";
        this.temperature = options.temperature ?? 0.7;
        this.maxOutputTokens = options.maxOutputTokens ?? 512;
        this.topP = options.topP;
        this.topK = options.topK;
    }

    private normalizeModel(modelName: string): string {
        return modelName.startsWith("models/") ? modelName : `models/${modelName}`;
    }

    private buildEndpoint(modelName: string, method: string): string {
        if (!this.apiKey) {
            throw new Error("Palm2Client: Missing Google PaLM2 API key.");
        }
        const modelPath = this.normalizeModel(modelName);
        const encodedKey = encodeURIComponent(this.apiKey);
        return `${this.baseUrl}/${modelPath}:${method}?key=${encodedKey}`;
    }

    async generateText(options: Palm2GenerateTextOptions | string): Promise<string> {
        const isStr = typeof options === "string";
        const opts: Palm2GenerateTextOptions = isStr ? { prompt: options } : options;
        if (!opts.prompt || !opts.prompt.trim()) {
            throw new Error("Palm2Client.generateText: prompt must be a non-empty string.");
        }

        const url = this.buildEndpoint(opts.model || this.textModel, "generateText");
        const payload: Record<string, unknown> = {
            prompt: { text: opts.prompt },
            temperature: opts.temperature ?? this.temperature,
            maxOutputTokens: opts.maxOutputTokens ?? this.maxOutputTokens,
        };
        if (opts.topP !== undefined || this.topP !== undefined) {
            payload.topP = opts.topP ?? this.topP;
        }
        if (opts.topK !== undefined || this.topK !== undefined) {
            payload.topK = opts.topK ?? this.topK;
        }
        if (opts.candidateCount !== undefined) {
            payload.candidateCount = opts.candidateCount;
        }
        if (opts.stopSequences?.length) {
            payload.stopSequences = opts.stopSequences;
        }

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Google PaLM2 generateText failed (${response.status}): ${errBody}`);
        }

        const data = (await response.json()) as {
            candidates?: Array<{ output?: string }>;
        };
        return data.candidates?.[0]?.output || "";
    }

    async chat(options: Palm2ChatOptions): Promise<string> {
        if (!Array.isArray(options.messages) || options.messages.length === 0) {
            throw new Error("Palm2Client.chat: messages array must not be empty.");
        }

        const url = this.buildEndpoint(options.model || this.chatModel, "generateMessage");
        const payload: Record<string, unknown> = {
            prompt: {
                context: options.context || "",
                examples: options.examples || [],
                messages: options.messages,
            },
            temperature: options.temperature ?? this.temperature,
            candidateCount: options.candidateCount ?? 1,
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Google PaLM2 chat failed (${response.status}): ${errBody}`);
        }

        const data = (await response.json()) as {
            candidates?: Array<{ content?: string }>;
        };
        return data.candidates?.[0]?.content || "";
    }

    async embedText(text: string, model = this.embeddingModel): Promise<number[]> {
        if (!text || !text.trim()) {
            throw new Error("Palm2Client.embedText: text must be a non-empty string.");
        }
        const url = this.buildEndpoint(model, "embedText");
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Google PaLM2 embedText failed (${response.status}): ${errBody}`);
        }
        const data = (await response.json()) as {
            embedding?: { value?: number[] };
        };
        return Array.isArray(data.embedding?.value) ? data.embedding.value : [];
    }
}

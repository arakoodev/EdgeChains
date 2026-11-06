import axios from "axios";
import { retry } from "@lifeomic/attempt";
import {
    Palm2ChatOptions,
    Palm2ConstructionOptions,
    Palm2EmbeddingOptions,
    Palm2EmbedTextResponse,
    Palm2GenerateMessageResponse,
    Palm2GenerateTextResponse,
    Palm2Message,
    Palm2TextOptions,
} from "../../types/palm2.js";

const DEFAULT_PALM2_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2";

export class Palm2AI {
    apiKey: string;
    baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || process.env.PALM2_API_KEY || "";
        this.baseUrl = options.baseUrl || DEFAULT_PALM2_BASE_URL;
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.warn("PaLM 2 API key is missing. Please provide a valid API key or set PALM_API_KEY in .env");
        }
    }

    private normalizeModel(model: string | undefined, defaultModel: string): string {
        const chosen = model || defaultModel;
        return chosen.startsWith("models/") ? chosen : `models/${chosen}`;
    }

    async generateText(options: Palm2TextOptions): Promise<Palm2GenerateTextResponse> {
        const modelPath = this.normalizeModel(options.model, "text-bison-001");
        const url = `${this.baseUrl}/${modelPath}:generateText?key=${this.apiKey}`;

        const payload = {
            prompt: { text: options.prompt },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
            ...(options.topP !== undefined ? { topP: options.topP } : {}),
            ...(options.topK !== undefined ? { topK: options.topK } : {}),
            ...(options.safetySettings ? { safetySettings: options.safetySettings } : {}),
            ...(options.stopSequences ? { stopSequences: options.stopSequences } : {}),
        };

        return await retry(
            async () => {
                const res = await axios.post(url, payload, { headers: { "Content-Type": "application/json" } });
                return res.data;
            },
            { maxAttempts: options.max_retry || 3, delay: options.delay || 200 }
        );
    }

    async chat(options: Palm2ChatOptions): Promise<Palm2GenerateMessageResponse> {
        const modelPath = this.normalizeModel(options.model, "chat-bison-001");
        const url = `${this.baseUrl}/${modelPath}:generateMessage?key=${this.apiKey}`;

        const messages: Palm2Message[] = options.messages?.length
            ? options.messages
            : options.prompt
              ? [{ author: "0", content: options.prompt }]
              : [];

        const payload = {
            prompt: {
                ...(options.context ? { context: options.context } : {}),
                ...(options.examples ? { examples: options.examples } : {}),
                messages,
            },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            ...(options.topP !== undefined ? { topP: options.topP } : {}),
            ...(options.topK !== undefined ? { topK: options.topK } : {}),
        };

        return await retry(
            async () => {
                const res = await axios.post(url, payload, { headers: { "Content-Type": "application/json" } });
                return res.data;
            },
            { maxAttempts: options.max_retry || 3, delay: options.delay || 200 }
        );
    }

    async generateEmbeddings(options: Palm2EmbeddingOptions): Promise<Palm2EmbedTextResponse> {
        const modelPath = this.normalizeModel(options.model, "embedding-gecko-001");
        const url = `${this.baseUrl}/${modelPath}:embedText?key=${this.apiKey}`;

        const payload = { text: options.text };

        return await retry(
            async () => {
                const res = await axios.post(url, payload, { headers: { "Content-Type": "application/json" } });
                return res.data;
            },
            { maxAttempts: options.max_retry || 3, delay: options.delay || 200 }
        );
    }
}

export { Palm2AI as Palm2Endpoint, Palm2AI as Palm2 };

import axios from "axios";
import { retry } from "@lifeomic/attempt";

const palm2BaseUrl = "https://generativelanguage.googleapis.com/v1beta2/models";

interface Palm2AIConstructionOptions {
    apiKey?: string;
}

interface Palm2AIChatOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    max_output_tokens?: number;
    max_retry?: number;
    delay?: number;
}

interface Palm2AIEmbeddingOptions {
    model?: string;
    text: string;
    max_retry?: number;
    delay?: number;
}

type SafetyRating = {
    category: string;
    probability: string;
};

type TextCompletion = {
    output: string;
    safetyRatings?: SafetyRating[];
};

export type Palm2GenerateTextResponse = {
    candidates: TextCompletion[];
    filters?: Array<{
        reason: string;
        message?: string;
    }>;
};

export type Palm2EmbedTextResponse = {
    embedding: {
        value: number[];
    };
};

export class Palm2AI {
    apiKey: string;

    constructor(options: Palm2AIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "";
    }

    async chat(chatOptions: Palm2AIChatOptions): Promise<Palm2GenerateTextResponse> {
        const model = chatOptions.model || "text-bison-001";
        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${palm2BaseUrl}/${model}:generateText`,
            params: {
                key: this.apiKey,
            },
            headers: {
                "Content-Type": "application/json",
            },
            data: {
                prompt: {
                    text: chatOptions.prompt,
                },
                temperature: chatOptions.temperature || 0.7,
                maxOutputTokens: chatOptions.max_output_tokens || 1024,
            },
        };

        return await retry(
            async () => {
                return (await axios.request(config)).data;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );
    }

    async generateEmbeddings(
        embeddingOptions: Palm2AIEmbeddingOptions
    ): Promise<Palm2EmbedTextResponse> {
        const model = embeddingOptions.model || "embedding-gecko-001";
        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${palm2BaseUrl}/${model}:embedText`,
            params: {
                key: this.apiKey,
            },
            headers: {
                "Content-Type": "application/json",
            },
            data: {
                text: embeddingOptions.text,
            },
        };

        return await retry(
            async () => {
                return (await axios.request(config)).data;
            },
            { maxAttempts: embeddingOptions.max_retry || 3, delay: embeddingOptions.delay || 200 }
        );
    }
}

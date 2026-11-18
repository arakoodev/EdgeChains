import axios from "axios";
import { retry } from "@lifeomic/attempt";

const palm2Url = "https://generativelanguage.googleapis.com/v1beta2/models";

export interface Palm2ConstructionOptions {
    apiKey?: string;
}

export type Palm2Author = "user" | "Bot";

export interface Palm2Message {
    author?: Palm2Author;
    content: string;
}

export interface Palm2GenerationParameters {
    temperature?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
    topK?: number;
    topP?: number;
    stopSequence?: string;
}

export interface Palm2ChatOptions extends Palm2GenerationParameters {
    model?: string;
    prompt?: string;
    messages?: Palm2Message[];
    max_retry?: number;
    delay?: number;
}

export interface Palm2TextOptions extends Palm2GenerationParameters {
    model?: string;
    prompt: string;
    max_retry?: number;
    delay?: number;
}

type SafetyRating = {
    category: string;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

type Citation = {
    startIndex: number;
    endIndex: number;
    url: string;
    license: string;
};

export type Palm2Candidate = {
    author?: string;
    content?: string;
    output?: string;
    citationMetadata?: { citation: Citation[] };
    safetyRatings?: SafetyRating[];
};

export type Palm2Filter = {
    reasonMetadata: { code: string };
    message: { text: string };
};

export type Palm2PromptFeedback = {
    safetyRatings: SafetyRating[];
    blockReason?: "BLOCK_REASON_UNSPECIFIED" | "SAFETY" | "OTHER";
    blockReasonMessage?: string;
};

export type Palm2ChatResponse = {
    candidates: Palm2Candidate[];
    filters?: Palm2Filter[];
    promptFeedback?: Palm2PromptFeedback;
};

export type Palm2TextResponse = {
    candidates: Palm2Candidate[];
    filters?: Palm2Filter[];
    promptFeedback?: Palm2PromptFeedback;
};

function buildGenerationParameters(options: Palm2GenerationParameters): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    if (options.temperature !== undefined) params.temperature = options.temperature;
    if (options.maxOutputTokens !== undefined) params.maxOutputTokens = options.maxOutputTokens;
    if (options.candidateCount !== undefined) params.candidateCount = options.candidateCount;
    if (options.topK !== undefined) params.topK = options.topK;
    if (options.topP !== undefined) params.topP = options.topP;
    if (options.stopSequence !== undefined) params.stopSequence = options.stopSequence;
    return params;
}

export class Palm2 {
    apiKey: string;
    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || "";
    }

    private async request<T>(url: string, data: object, maxAttempts = 3, delay = 200): Promise<T> {
        return await retry(
            async () =>
                (
                    await axios.post(url, data, {
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": this.apiKey,
                        },
                    })
                ).data,
            { maxAttempts, delay },
        );
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<Palm2ChatResponse> {
        const messages = chatOptions.messages || [
            { author: "user" as Palm2Author, content: chatOptions.prompt || "" },
        ];
        const data = {
            messages,
            ...buildGenerationParameters(chatOptions),
        };
        const url = `${palm2Url}/${chatOptions.model || "chat-bison-001"}:generateMessage`;
        return await this.request<Palm2ChatResponse>(
            url,
            data,
            chatOptions.max_retry,
            chatOptions.delay,
        );
    }

    async generateText(textOptions: Palm2TextOptions): Promise<Palm2TextResponse> {
        const data = {
            prompt: textOptions.prompt,
            ...buildGenerationParameters(textOptions),
        };
        const url = `${palm2Url}/${textOptions.model || "text-bison-001"}:generateText`;
        return await this.request<Palm2TextResponse>(
            url,
            data,
            textOptions.max_retry,
            textOptions.delay,
        );
    }
}

import axios from "axios";
import { retry } from "@lifeomic/attempt";

const url = "https://generativelanguage.googleapis.com/v1/models/text-bison-001:generateText";

interface Palm2AIConstructionOptions {
    apiKey?: string;
}

type SafetyRating = {
    category:
        | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
        | "HARM_CATEGORY_HATE_SPEECH"
        | "HARM_CATEGORY_HARASSMENT"
        | "HARM_CATEGORY_DANGEROUS_CONTENT";
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

type ContentFilter = {
    reason:
        | "OTHER"
        | "BLOCKED_REASON_UNSPECIFIED"
        | "SAFETY"
        | "BLOCKLIST"
        | "PROHIBITED_CONTENT";
    message?: string;
};

type Palm2Candidate = {
    output: string;
    safetyRatings: SafetyRating[];
};

type Palm2Response = {
    candidates: Palm2Candidate[];
    filters: ContentFilter[];
};

interface Palm2ChatOptions {
    model?: string;
    temperature?: number;
    candidateCount?: number;
    topK?: number;
    topP?: number;
    maxTokenCount?: number;
    prompt: string;
    max_retry?: number;
    delay?: number;
}

export class Palm2AI {
    apiKey: string;
    constructor(options: Palm2AIConstructionOptions) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || "";
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid Google Palm2 API key. You can add it in .env file as PALM2_API_KEY"
            );
        }
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<Palm2Response> {
        const model = chatOptions.model || "text-bison-001";
        const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateText`;

        const data = JSON.stringify({
            prompt: {
                text: chatOptions.prompt,
            },
            temperature: chatOptions.temperature ?? 0.7,
            candidateCount: chatOptions.candidateCount ?? 1,
            topK: chatOptions.topK ?? 40,
            topP: chatOptions.topP ?? 0.95,
            maxTokenCount: chatOptions.maxTokenCount ?? 1024,
        });

        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url: endpoint,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: data,
        };

        return await retry(
            async () => {
                return (await axios.request(config)).data;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );
    }
}
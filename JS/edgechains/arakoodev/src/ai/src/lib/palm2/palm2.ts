import axios from "axios";
import { retry } from "@lifeomic/attempt";

export interface Palm2ConstructionOptions {
    apiKey?: string;
}

export interface Palm2ChatOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
    stopSequences?: string[];
    max_retry?: number;
    delay?: number;
}

type SafetyRating = {
    category: string;
    probability: string;
};

type Palm2Candidate = {
    output: string;
    safetyRatings?: SafetyRating[];
};

export type Palm2GenerateTextResponse = {
    candidates: Palm2Candidate[];
    filters?: unknown[];
};

const baseUrl = "https://generativelanguage.googleapis.com/v1beta2/models";

export class Palm2AI {
    apiKey: string;

    constructor(options: Palm2ConstructionOptions) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "";
    }

    private checkKey(): void {
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid PaLM API key. You can add it in .env as PALM2_API_KEY or GOOGLE_API_KEY."
            );
        }
    }

    async generateText(chatOptions: Palm2ChatOptions): Promise<Palm2GenerateTextResponse> {
        this.checkKey();

        const model = chatOptions.model || "text-bison-001";
        const url = `${baseUrl}/${model}:generateText`;

        const data = {
            prompt: {
                text: chatOptions.prompt,
            },
            temperature: chatOptions.temperature ?? 0.7,
            maxOutputTokens: chatOptions.maxOutputTokens ?? 1024,
            topK: chatOptions.topK,
            topP: chatOptions.topP,
            stopSequences: chatOptions.stopSequences,
        };

        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: JSON.stringify(data),
        };

        return await retry(
            async () => {
                return (await axios.request(config)).data;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<string> {
        const res = await this.generateText(chatOptions);
        return res?.candidates?.[0]?.output || "";
    }
}


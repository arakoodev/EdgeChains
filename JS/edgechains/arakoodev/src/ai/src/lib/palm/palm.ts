import axios from "axios";
import { retry } from "@lifeomic/attempt";

interface PalmAIConstructionOptions {
    apiKey?: string;
}

export type PalmSafetyRating = {
    category:
        | "HARM_CATEGORY_UNSPECIFIED"
        | "HARM_CATEGORY_DEROGATORY"
        | "HARM_CATEGORY_TOXIC"
        | "HARM_CATEGORY_SEXUAL"
        | "HARM_CATEGORY_VIOLENT"
        | "HARM_CATEGORY_DANGEROUS"
        | "HARM_CATEGORY_MEDICAL"
        | "HARM_CATEGORY_DANGEROUS_CONTENT";
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
};

export type PalmCandidate = {
    output: string;
    safetyRatings?: PalmSafetyRating[];
};

export type PalmResponse = {
    candidates: PalmCandidate[];
    filters?: any[];
    safetyFeedback?: any[];
};

interface PalmAIChatOptions {
    model?: string;
    max_output_tokens?: number;
    temperature?: number;
    prompt: string;
    max_retry?: number;
    delay?: number;
    topP?: number;
    topK?: number;
}

export class PalmAI {
    apiKey: string;
    constructor(options: PalmAIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || "";
    }

    async chat(chatOptions: PalmAIChatOptions): Promise<PalmResponse> {
        const model = chatOptions.model || "text-bison-001";
        const url = `https://generativelanguage.googleapis.com/v1beta2/models/${model}:generateText`;

        const requestData: any = {
            prompt: {
                text: chatOptions.prompt,
            },
        };

        if (chatOptions.temperature !== undefined) {
            requestData.temperature = chatOptions.temperature;
        }
        if (chatOptions.max_output_tokens !== undefined) {
            requestData.maxOutputTokens = chatOptions.max_output_tokens;
        }
        if (chatOptions.topP !== undefined) {
            requestData.topP = chatOptions.topP;
        }
        if (chatOptions.topK !== undefined) {
            requestData.topK = chatOptions.topK;
        }

        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${url}?key=${this.apiKey}`,
            headers: {
                "Content-Type": "application/json",
            },
            data: JSON.stringify(requestData),
        };

        return await retry(
            async () => {
                const response = await axios.request(config);
                return response.data;
            },
            {
                maxAttempts: chatOptions.max_retry || 3,
                delay: chatOptions.delay || 200,
            }
        );
    }
}

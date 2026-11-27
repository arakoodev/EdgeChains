import axios from "axios";
import { retry } from "@lifeomic/attempt";

const url =
    "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText";

export interface Palm2ConstructionOptions {
    apiKey?: string;
}

export type Palm2SafetyCategory =
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS_CONTENT";

export type Palm2SafetyRating = {
    category: Palm2SafetyCategory;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

export type Palm2Feedback = {
    blockReason?: string;
    safetyRatings: Palm2SafetyRating[];
};

export type Palm2TextPrompt = {
    text: string;
};

export type Palm2Candidate = {
    output: string;
    safetyRatings: Palm2SafetyRating[];
};

export type Palm2Response = {
    candidates: Palm2Candidate[];
    filters?: unknown[];
    safetyFeedback?: unknown[];
};

export interface Palm2ChatOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    max_output_tokens?: number;
    top_p?: number;
    top_k?: number;
    max_retry?: number;
    delay?: number;
}

/**
 * Palm2 endpoint for EdgeChains JS SDK.
 * Mirrors the GeminiAI class interface; talks to the Google PaLM 2
 * (text-bison) generateText API.
 */
export class Palm2Endpoint {
    apiKey: string;

    constructor(options: Palm2ConstructionOptions) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || "";
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<Palm2Response> {
        const model = chatOptions.model || "text-bison-001";
        const endpointUrl = url.replace("text-bison-001", model);
        let data = JSON.stringify({
            prompt: { text: chatOptions.prompt },
            temperature: chatOptions.temperature ?? 0.7,
            maxOutputTokens: chatOptions.max_output_tokens ?? 1024,
            topP: chatOptions.top_p ?? 0.95,
            topK: chatOptions.top_k ?? 40,
        });

        let config = {
            method: "post" as const,
            maxBodyLength: Infinity,
            url: endpointUrl,
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

    /** Convenience helper: returns the first candidate's text output. */
    async gptFn(prompt: string, chatOptions: Omit<Palm2ChatOptions, "prompt"> = {}): Promise<string> {
        const response = await this.chat({ ...chatOptions, prompt });
        return response.candidates?.[0]?.output ?? "";
    }
}

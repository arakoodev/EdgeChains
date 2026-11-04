import axios from "axios";
import { retry } from "@lifeomic/attempt";

const url = "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText";

export interface Palm2AIConstructionOptions {
    apiKey?: string;
}

export interface Palm2SafetySetting {
    category:
        | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
        | "HARM_CATEGORY_HATE_SPEECH"
        | "HARM_CATEGORY_HARASSMENT"
        | "HARM_CATEGORY_DANGEROUS_CONTENT";
    threshold:
        | "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
        | "BLOCK_LOW_AND_ABOVE"
        | "BLOCK_MEDIUM_AND_ABOVE"
        | "BLOCK_ONLY_HIGH"
        | "BLOCK_NONE";
}

export interface Palm2AIChatOptions {
    prompt: string;
    model?: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
    safetySettings?: Palm2SafetySetting[];
    stopSequences?: string[];
    max_retry?: number;
    delay?: number;
}

export type Palm2SafetyRating = {
    category: string;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

export type Palm2CitationSource = {
    startIndex: number;
    endIndex: number;
    uri: string;
    license: string;
};

export type Palm2CitationMetadata = {
    citationSources: Palm2CitationSource[];
};

export type Palm2Candidate = {
    output: string;
    safetyRatings: Palm2SafetyRating[];
    citationMetadata: Palm2CitationMetadata;
};

export type Palm2Response = {
    candidates: Palm2Candidate[];
    safetyFeedback?: Palm2SafetyRating[];
};

export class Palm2AI {
    apiKey: string;

    constructor(options: Palm2AIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "";
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.warn(
                "API key is missing. Please provide a valid Google Palm2 API key. You can add it in .env file as PALM2_API_KEY"
            );
        }
    }

    async chat(chatOptions: Palm2AIChatOptions): Promise<Palm2Response> {
        const data = JSON.stringify({
            prompt: {
                text: chatOptions.prompt,
            },
            temperature: chatOptions.temperature ?? 0.7,
            topP: chatOptions.topP ?? 0.95,
            topK: chatOptions.topK ?? 40,
            maxOutputTokens: chatOptions.maxOutputTokens ?? 1024,
            candidateCount: chatOptions.candidateCount ?? 1,
            safetySettings: chatOptions.safetySettings ?? [],
            stopSequences: chatOptions.stopSequences ?? [],
        });

        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data,
        };

        return await retry(
            async () => {
                return (await axios.request(config)).data;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );
    }

    async generateText(chatOptions: Palm2AIChatOptions): Promise<string> {
        const response = await this.chat(chatOptions);
        if (!response.candidates || response.candidates.length === 0) {
            throw new Error("Palm2 API returned no candidates.");
        }
        return response.candidates[0].output;
    }
}

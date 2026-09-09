import axios from "axios";
import { retry } from "@lifeomic/attempt";

const defaultBaseUrl = "https://generativelanguage.googleapis.com/v1beta2";

interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

type Palm2SafetyCategory =
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS";

type Palm2SafetyThreshold =
    | "BLOCK_NONE"
    | "BLOCK_ONLY_HIGH"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_LOW_AND_ABOVE";

interface Palm2SafetySetting {
    category: Palm2SafetyCategory;
    threshold: Palm2SafetyThreshold;
}

interface Palm2TextOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    safetySettings?: Palm2SafetySetting[];
    max_retry?: number;
    delay?: number;
}

interface Palm2Candidate {
    output: string;
    safetyRatings?: Array<{
        category: Palm2SafetyCategory;
        probability: string;
    }>;
}

interface Palm2TextResponse {
    candidates: Palm2Candidate[];
}

export class Palm2AI {
    apiKey: string;
    baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || "";
        this.baseUrl = (options.baseUrl || defaultBaseUrl).replace(/\/$/, "");
    }

    async generateText(options: Palm2TextOptions): Promise<Palm2TextResponse> {
        const model = options.model || "text-bison-001";
        const url = `${this.baseUrl}/models/${model}:generateText?key=${this.apiKey}`;
        const data = {
            prompt: {
                text: options.prompt,
            },
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
            topP: options.topP,
            topK: options.topK,
            candidateCount: options.candidateCount,
            safetySettings: options.safetySettings,
        };

        return await retry(
            async () => {
                return (
                    await axios.post(url, data, {
                        headers: {
                            "Content-Type": "application/json",
                        },
                    })
                ).data;
            },
            { maxAttempts: options.max_retry || 3, delay: options.delay || 200 }
        );
    }

    async chat(options: Palm2TextOptions): Promise<Palm2Candidate> {
        const response = await this.generateText(options);
        return response.candidates[0];
    }
}

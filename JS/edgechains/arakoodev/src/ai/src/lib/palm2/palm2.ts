import axios from "axios";
import { retry } from "@lifeomic/attempt";

const DEFAULT_MODEL = "models/text-bison-001";
const GENERATE_TEXT_URL =
    "https://generativelanguage.googleapis.com/v1beta/{model}:generateText";

interface Palm2AIConstructionOptions {
    apiKey?: string;
}

interface Palm2AIChatOptions {
    model?: string;
    prompt: string;
    candidate_count?: number;
    max_output_tokens?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    max_retry?: number;
    delay?: number;
}

type Palm2SafetyRating = {
    category: string;
    probability: string;
};

type Palm2Candidate = {
    output: string;
    safetyRatings?: Palm2SafetyRating[];
};

type Palm2Response = {
    candidates: Palm2Candidate[];
    filters?: unknown[];
};

export class Palm2AI {
    apiKey: string;

    constructor(options: Palm2AIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "";
    }

    async chat(chatOptions: Palm2AIChatOptions): Promise<Palm2Response> {
        const model = chatOptions.model || DEFAULT_MODEL;
        const url = GENERATE_TEXT_URL.replace("{model}", model);

        const data = {
            prompt: {
                text: chatOptions.prompt,
            },
            candidateCount: chatOptions.candidate_count || 1,
            maxOutputTokens: chatOptions.max_output_tokens || 1024,
            temperature: chatOptions.temperature || 0.7,
            topK: chatOptions.top_k,
            topP: chatOptions.top_p,
        };

        return await retry(
            async () => {
                return (
                    await axios.post(url, data, {
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": this.apiKey,
                        },
                    })
                ).data;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );
    }
}

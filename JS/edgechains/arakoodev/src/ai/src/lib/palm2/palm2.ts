import axios from "axios";
import { retry } from "@lifeomic/attempt";

export type Palm2Model =
    | "text-bison-001"
    | "text-bison-002"
    | "text-bison"
    | "text-unicorn-001"
    | "chat-bison-001"
    | "chat-bison-002"
    | "chat-bison";

type Palm2SafetyCategory =
    | "HARM_CATEGORY_UNSPECIFIED"
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS";

type Palm2SafetyProbability = "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";

interface Palm2SafetySetting {
    category: Palm2SafetyCategory;
    threshold: Palm2SafetyProbability;
}

interface Palm2Prompt {
    text: string;
}

interface Palm2SafetyRating {
    category: Palm2SafetyCategory;
    probability: Palm2SafetyProbability;
    blocked?: boolean;
}

interface Palm2Candidate {
    output: string;
    safetyRatings: Palm2SafetyRating[];
}

interface Palm2Filter {
    reason: string;
    message: string;
}

interface Palm2SafetyFeedback {
    rating: Palm2SafetyRating;
    setting: Palm2SafetySetting;
}

interface Palm2GenerateResponse {
    candidates: Palm2Candidate[];
    filters: Palm2Filter[];
    safetyFeedback: Palm2SafetyFeedback[];
}

interface Palm2ConstructionOptions {
    apiKey?: string;
}

interface Palm2ChatOptions {
    model?: Palm2Model;
    prompt: string;
    temperature?: number;
    max_output_tokens?: number;
    top_p?: number;
    top_k?: number;
    candidate_count?: number;
    safety_settings?: Palm2SafetySetting[];
    max_retry?: number;
    delay?: number;
}

interface Palm2ChatReturnOptions {
    content: string;
}

export class Palm2AI {
    apiKey: string;

    constructor(options: Palm2ConstructionOptions) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || "";
        this.checkKey();
    }

    private checkKey(): void {
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid Google PaLM2 API key. You can add it in .env file as PALM2_API_KEY"
            );
        }
    }

    private getUrl(model: string): string {
        return `https://generativelanguage.googleapis.com/v1beta2/models/${model}:generateText`;
    }

    async generateText(chatOptions: Palm2ChatOptions): Promise<Palm2ChatReturnOptions> {
        const url = this.getUrl(chatOptions.model || "text-bison-001");

        const requestBody = {
            prompt: {
                text: chatOptions.prompt,
            },
            temperature: chatOptions.temperature ?? 0.7,
            max_output_tokens: chatOptions.max_output_tokens || 1024,
            top_p: chatOptions.top_p ?? 0.95,
            top_k: chatOptions.top_k ?? 40,
            candidate_count: chatOptions.candidate_count || 1,
            safety_settings: chatOptions.safety_settings || [],
        };

        const response = await retry(
            async () => {
                return (await axios.post(url, requestBody, {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    params: {
                        key: this.apiKey,
                    },
                })).data as Palm2GenerateResponse;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error("No candidates returned from Palm2 API");
        }

        return { content: response.candidates[0].output };
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<Palm2ChatReturnOptions> {
        return this.generateText(chatOptions);
    }

    async generateEmbeddings({ input, model }: { input: string[]; model: string }): Promise<any> {
        const url = `https://generativelanguage.googleapis.com/v1beta2/models/${model}:embedText`;

        const response = await retry(
            async () => {
                return (await axios.post(
                    url,
                    { text: input[0] },
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                        params: {
                            key: this.apiKey,
                        },
                    }
                )).data;
            },
            { maxAttempts: 3, delay: 200 }
        );

        return response;
    }
}

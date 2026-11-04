import axios from "axios";
import { retry } from "@lifeomic/attempt";

const palm2_url = "https://generativelanguage.googleapis.com/v1beta2/models";

interface Palm2ConstructionOptions {
    apiKey?: string;
}

type SafetyRating = {
    category: string;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

type TextCandidate = {
    output: string;
    safetyRatings: SafetyRating[];
};

type GenerateTextResponse = {
    candidates: TextCandidate[];
};

type SafetySetting = {
    category: string;
    threshold: 1 | 2 | 3 | 4 | 5;
};

interface Palm2ChatOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
    safetySettings?: SafetySetting[];
    stopSequences?: string[];
    max_retry?: number;
    delay?: number;
}

interface Palm2EmbeddingOptions {
    model?: string;
    text: string;
    max_retry?: number;
    delay?: number;
}

interface Palm2ChatReturnOptions {
    content: string;
}

export class Palm2 {
    apiKey: string;
    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "";
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid Google API key. You can add it in .env file as PALM2_API_KEY"
            );
        }
    }

    /**
     * Generate a text completion with a PaLM 2 model (e.g. text-bison-001).
     * @param chatOptions prompt + generation parameters.
     * @returns The first candidate's text output.
     */
    async chat(chatOptions: Palm2ChatOptions): Promise<Palm2ChatReturnOptions> {
        const model = chatOptions.model || "text-bison-001";
        const url = `${palm2_url}/${model}:generateText`;
        const data = {
            prompt: { text: chatOptions.prompt },
            temperature: chatOptions.temperature ?? 0.7,
            candidateCount: chatOptions.candidateCount ?? 1,
            maxOutputTokens: chatOptions.maxOutputTokens ?? 256,
            ...(chatOptions.topK !== undefined ? { top_k: chatOptions.topK } : {}),
            ...(chatOptions.topP !== undefined ? { top_p: chatOptions.topP } : {}),
            ...(chatOptions.safetySettings ? { safetySettings: chatOptions.safetySettings } : {}),
            ...(chatOptions.stopSequences ? { stopSequences: chatOptions.stopSequences } : {}),
        };
        const response = await retry(
            async () => {
                const res = await axios.post(url, data, {
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                });
                return res.data as GenerateTextResponse;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );
        return { content: response.candidates?.[0]?.output ?? "" };
    }

    /**
     * Embed text with a PaLM 2 embedding model (embedding-gecko-001).
     * @param options text + model.
     * @returns The embedding value array.
     */
    async generateEmbeddings({ text, model = "embedding-gecko-001", max_retry = 3, delay = 200 }: Palm2EmbeddingOptions): Promise<any> {
        const url = `${palm2_url}/${model}:embedText`;
        return retry(
            async () => {
                const res = await axios.post(
                    url,
                    { text },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": this.apiKey,
                        },
                    }
                );
                return res.data;
            },
            { maxAttempts: max_retry, delay }
        );
    }
}

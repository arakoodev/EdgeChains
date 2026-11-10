import axios from "axios";
import { retry } from "@lifeomic/attempt";

const palm2BaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

interface Palm2ConstructionOptions {
    apiKey?: string;
}

interface Palm2ChatOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
    maxRetry?: number;
    delay?: number;
}

interface Palm2BatchOptions {
    model?: string;
    prompts: string[];
    temperature?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
    maxRetry?: number;
    delay?: number;
}

interface Palm2Response {
    candidates: Array<{
        content: {
            parts: Array<{ text: string }>;
            role: string;
        };
        finishReason: string;
        index: number;
    }>;
    usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
}

interface Palm2ChatReturn {
    content: string;
    finishReason: string;
    usage: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
}

/**
 * Palm2 - Google Generative AI (Palm 2 / Gemini) API client.
 * 
 * Uses the Google Generative Language API v1beta endpoint.
 * Docs: https://developers.generativeai.google/
 */
export class Palm2 {
    apiKey: string;

    constructor(options: Palm2ConstructionOptions) {
        this.apiKey = options.apiKey || process.env.GOOGLE_API_KEY || process.env.PALM2_API_KEY || "";
        this.checkKey();
    }

    private checkKey(): void {
        if (!this.apiKey) {
            console.error(
                "Google API key is missing. Please provide a valid API key. " +
                "You can add it in .env file as GOOGLE_API_KEY or PALM2_API_KEY"
            );
        }
    }

    private buildUrl(model: string, action: string): string {
        return `${palm2BaseUrl}/${model}:${action}?key=${this.apiKey}`;
    }

    /**
     * Generate a single response from the model.
     */
    async chat(options: Palm2ChatOptions): Promise<Palm2ChatReturn> {
        const model = options.model || "gemini-pro";
        const url = this.buildUrl(model, "generateContent");

        const body = {
            contents: [
                {
                    role: "user",
                    parts: [{ text: options.prompt }],
                },
            ],
            generationConfig: {
                temperature: options.temperature ?? 1.0,
                maxOutputTokens: options.maxOutputTokens ?? 80,
                topK: options.topK ?? 40,
                topP: options.topP ?? 0.95,
            },
        };

        const maxRetry = options.maxRetry ?? 3;
        const delay = options.delay ?? 1000;

        try {
            const response = await retry(
                () => axios.post(url, body),
                { delay, maxAttempts: maxRetry }
            );

            const data: Palm2Response = response.data;
            const candidate = data.candidates?.[0];

            if (!candidate) {
                throw new Error("No candidates returned from Palm2 API");
            }

            return {
                content: candidate.content?.parts?.map((p) => p.text).join("") || "",
                finishReason: candidate.finishReason || "UNKNOWN",
                usage: data.usageMetadata || {
                    promptTokenCount: 0,
                    candidatesTokenCount: 0,
                    totalTokenCount: 0,
                },
            };
        } catch (error: any) {
            if (error.response) {
                throw new Error(
                    `Palm2 API error ${error.response.status}: ${JSON.stringify(error.response.data)}`
                );
            }
            throw error;
        }
    }

    /**
     * Generate responses for multiple prompts.
     */
    async batchChat(options: Palm2BatchOptions): Promise<Palm2ChatReturn[]> {
        const results: Palm2ChatReturn[] = [];

        for (const prompt of options.prompts) {
            const result = await this.chat({
                model: options.model,
                prompt,
                temperature: options.temperature,
                maxOutputTokens: options.maxOutputTokens,
                topK: options.topK,
                topP: options.topP,
                maxRetry: options.maxRetry,
                delay: options.delay,
            });
            results.push(result);
        }

        return results;
    }

    /**
     * Count tokens in a prompt.
     */
    async countTokens(prompt: string, model?: string): Promise<number> {
        const m = model || "gemini-pro";
        const url = this.buildUrl(m, "countTokens");

        try {
            const response = await axios.post(url, {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }],
                    },
                ],
            });
            return response.data?.totalTokens || 0;
        } catch (error: any) {
            if (error.response) {
                throw new Error(
                    `Palm2 countTokens error ${error.response.status}: ${JSON.stringify(error.response.data)}`
                );
            }
            throw error;
        }
    }

    /**
     * List available models.
     */
    async listModels(): Promise<Array<{ name: string; displayName: string; description: string }>> {
        const url = `${palm2BaseUrl}/models?key=${this.apiKey}`;

        try {
            const response = await axios.get(url);
            const models = response.data?.models || [];
            return models.map((m: any) => ({
                name: m.name || "",
                displayName: m.displayName || "",
                description: m.description || "",
            }));
        } catch (error: any) {
            if (error.response) {
                throw new Error(
                    `Palm2 listModels error ${error.response.status}: ${JSON.stringify(error.response.data)}`
                );
            }
            throw error;
        }
    }
}
import axios from "axios";
import { retry } from "@lifeomic/attempt";
import {
    Palm2BaseOptions,
    Palm2TextOptions,
    Palm2ChatOptions,
    Palm2TextResponse,
    Palm2ChatResponse,
} from "./types.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/";
const LEGACY_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2/models/";

/**
 * Palm2AI class to interact with Google's Generative AI APIs.
 * Supports legacy PaLM 2 (Bison) and provides fallback for Gemini models.
 */
export class Palm2AI {
    private apiKey: string;

    constructor(options: { apiKey?: string } = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || "";
        if (!this.apiKey) {
            console.warn("PALM2_API_KEY is missing.");
        }
    }

    /**
     * Determines if a model is a legacy PaLM 2 model.
     */
    private isLegacy(model: string): boolean {
        return model.includes("bison") || model.includes("palm");
    }

    async generateText(options: Palm2TextOptions): Promise<any> {
        const model = options.model || "text-bison-001";
        
        if (this.isLegacy(model)) {
            const url = `${LEGACY_BASE_URL}${model}:generateText?key=${this.apiKey}`;
            const payload = {
                prompt: { text: options.prompt },
                temperature: options.temperature,
                maxOutputTokens: options.maxOutputTokens,
            };
            return this.makeRequest(url, payload);
        } else {
            // Gemini Fallback
            const url = `${BASE_URL}models/${model}:generateContent?key=${this.apiKey}`;
            const payload = {
                contents: [{ parts: [{ text: options.prompt }] }],
                generationConfig: {
                    temperature: options.temperature,
                    maxOutputTokens: options.maxOutputTokens,
                }
            };
            return this.makeRequest(url, payload);
        }
    }

    async generateMessage(options: Palm2ChatOptions): Promise<any> {
        const model = options.model || "chat-bison-001";

        if (this.isLegacy(model)) {
            const url = `${LEGACY_BASE_URL}${model}:generateMessage?key=${this.apiKey}`;
            const payload = {
                prompt: {
                    context: options.context,
                    messages: options.messages,
                },
                temperature: options.temperature,
            };
            return this.makeRequest(url, payload);
        } else {
            // Gemini Fallback for Chat
            const url = `${BASE_URL}models/${model}:generateContent?key=${this.apiKey}`;
            const payload = {
                system_instruction: options.context ? { parts: [{ text: options.context }] } : undefined,
                contents: options.messages.map(m => ({
                    role: m.author === "bot" || m.author === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }]
                })),
                generationConfig: { temperature: options.temperature }
            };
            return this.makeRequest(url, payload);
        }
    }

    async chat(options: { prompt: string; model?: string; temperature?: number }): Promise<any> {
        const model = options.model || (this.apiKey.startsWith("AIza") ? "gemini-1.5-flash" : "chat-bison-001");
        return this.generateMessage({
            model: model,
            temperature: options.temperature,
            messages: [{ content: options.prompt }],
        });
    }

    private async makeRequest(url: string, payload: any): Promise<any> {
        return await retry(
            async () => {
                try {
                    const response = await axios.post(url, payload, {
                        headers: { "Content-Type": "application/json" },
                    });
                    return response.data;
                } catch (error: any) {
                    this.handleError(error);
                    throw error;
                }
            },
            { maxAttempts: 3, delay: 200 }
        );
    }

    private handleError(error: any): void {
        const status = error.response?.status;
        const data = JSON.stringify(error.response?.data);
        console.error(`Google AI API Error: ${status} - ${data}`);
    }
}

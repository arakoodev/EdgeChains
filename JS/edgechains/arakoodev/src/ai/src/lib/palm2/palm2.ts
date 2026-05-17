import axios from "axios";
import { ChatModel, role } from "../../types/index";

const PALM2_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

interface Palm2ConstructionOptions {
    apiKey?: string;
}

interface MessageOption {
    role: role;
    content: string;
    name?: string;
}

interface Palm2ChatOptions {
    model?: ChatModel;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    messages?: MessageOption[];
}

interface Palm2ChatReturnOptions {
    content: string;
}

export class Palm2 {
    apiKey: string;

    constructor(options: Palm2ConstructionOptions) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || "";
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid Palm2 API key. You can add it in .env file as PALM2_API_KEY"
            );
        }
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<Palm2ChatReturnOptions> {
        const model = chatOptions.model || "gemini-pro";
        const url = `${PALM2_URL}${model}:generateContent?key=${this.apiKey}`;

        const messages = chatOptions.prompt
            ? [
                  {
                      role: "user",
                      content: {
                          parts: [{ text: chatOptions.prompt }],
                      },
                  },
              ]
            : chatOptions.messages?.map((msg) => ({
                role: msg.role === "assistant" ? "model" : "user",
                content: {
                    parts: [{ text: msg.content }],
                },
              })) || [];

        try {
            const response = await axios.post(url, {
                contents: messages,
                generationConfig: {
                    maxOutputTokens: chatOptions.max_tokens || 256,
                    temperature: chatOptions.temperature || 0.7,
                },
            });

            const candidate = response.data.candidates[0];
            if (!candidate || !candidate.content) {
                throw new Error("No content returned from Palm2 API");
            }

            return {
                content: candidate.content.parts[0].text,
            };
        } catch (error: any) {
            if (error.response) {
                console.error("Palm2 API responded with status code:", error.response.status);
                console.error("Response data:", error.response.data);
            } else {
                console.error("Error creating request:", error.message);
            }
            throw error;
        }
    }

    async streamedChat(chatOptions: Palm2ChatOptions): Promise<Palm2ChatReturnOptions> {
        // Palm2/Gemini uses streamGenerateContent for streaming
        const model = chatOptions.model || "gemini-pro";
        const url = `${PALM2_URL}${model}:streamGenerateContent?alt=sse`;
        
        const messages = chatOptions.prompt
            ? [
                {
                    role: "user",
                    content: {
                        parts: [{ text: chatOptions.prompt }],
                    },
                },
            ]
            : chatOptions.messages?.map((msg) => ({
                role: msg.role === "assistant" ? "model" : "user",
                content: {
                    parts: [{ text: msg.content }],
                },
            })) || [];

        try {
            const response = await axios.post(url, 
                {
                    contents: messages,
                    generationConfig: {
                        maxOutputTokens: chatOptions.max_tokens || 256,
                        temperature: chatOptions.temperature || 0.7,
                    },
                },
                {
                    params: { key: this.apiKey },
                    responseType: 'stream'
                }
            );

            // In a real SDK implementation for an SDK, we'd return a ReadableStream or AsyncIterable.
            // For consistency with the OpenAI class in this project, we'll return the final aggregated content.
            let fullContent = "";
            for await (const chunk of response.data) {
                fullContent += chunk.toString();
            }
            return {
                content: fullContent,
            };
        } catch (error: any) {
            console.error("Error in Palm2 streamedChat:", error.message);
            throw error;
        }
    }
}
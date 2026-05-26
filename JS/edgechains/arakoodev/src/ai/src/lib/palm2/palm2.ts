import axios from "axios";

export interface Palm2Message {
    author: string;
    content: string;
}

export interface Palm2Example {
    input: Palm2Message;
    output: Palm2Message;
}

export interface Palm2Prompt {
    context?: string;
    examples?: Palm2Example[];
    messages: Palm2Message[];
}

export interface Palm2Candidate {
    author: string;
    content: string;
}

export interface Palm2GenerateMessageResponse {
    candidates: Palm2Candidate[];
}

export interface Palm2ChatOptions {
    model?: string;
    prompt?: string;
    messages?: Palm2Message[];
    context?: string;
    examples?: Palm2Example[];
    temperature?: number;
    top_p?: number;
    top_k?: number;
    candidate_count?: number;
    max_output_tokens?: number;
}

export interface Palm2ConstructionOptions {
    apiKey?: string;
}

const palm2BaseUrl = "https://generativelanguage.googleapis.com/v1beta2/models";

export class Palm2AI {
    apiKey: string;

    constructor(options: Palm2ConstructionOptions) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || "";
    }

    private buildPrompt(chatOptions: Palm2ChatOptions): Palm2Prompt {
        if (chatOptions.messages?.length) {
            return {
                context: chatOptions.context,
                examples: chatOptions.examples,
                messages: chatOptions.messages,
            };
        }

        return {
            context: chatOptions.context,
            examples: chatOptions.examples,
            messages: [
                {
                    author: "user",
                    content: chatOptions.prompt || "",
                },
            ],
        };
    }

    async chat(
        chatOptions: Palm2ChatOptions,
    ): Promise<Palm2GenerateMessageResponse> {
        const model = chatOptions.model || "chat-bison-001";
        const response = await axios.post<Palm2GenerateMessageResponse>(
            `${palm2BaseUrl}/${model}:generateMessage`,
            {
                prompt: this.buildPrompt(chatOptions),
                temperature: chatOptions.temperature ?? 0.7,
                top_p: chatOptions.top_p ?? 0.95,
                top_k: chatOptions.top_k ?? 40,
                candidate_count: chatOptions.candidate_count ?? 1,
                max_output_tokens: chatOptions.max_output_tokens ?? 256,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": this.apiKey,
                },
            },
        );

        return response.data;
    }
}

import { OpenAiEndpoint, type RouterRoute } from "../OpenAiEndpoint.js";

interface StreamOptions {
    OpenApiKey?: string;
    apiKey?: string;
    orgId?: string;
    model?: string;
    temperature?: number;
    role?: "user" | "assistant" | "system";
    routes?: RouterRoute[];
}

export class Stream {
    endpoint: OpenAiEndpoint;

    constructor(options: StreamOptions) {
        this.endpoint = new OpenAiEndpoint({
            url: "https://api.openai.com/v1/chat/completions",
            apiKey: options.apiKey || options.OpenApiKey || "",
            orgId: options.orgId,
            model: options.model,
            role: options.role || "user",
            temperature: options.temperature,
            routes: options.routes,
        });
    }

    async OpenAIStream(prompt: string): Promise<ReadableStream<Uint8Array>> {
        const content = await this.endpoint.gptFn(prompt);
        const encoder = new TextEncoder();

        return new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(JSON.stringify([{ choices: [{ delta: { content } }] }])));
                controller.enqueue(encoder.encode("[DONE]"));
                controller.close();
            },
        });
    }
}


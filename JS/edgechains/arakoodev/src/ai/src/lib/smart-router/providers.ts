import axios, { type AxiosInstance } from "axios";
import { retry } from "@lifeomic/attempt";
import type {
    ChatRequest,
    ChatResponse,
    Message,
    ModelDeployment,
    StreamChunk,
    TokenUsage,
} from "./types.js";

/**
 * Creates an axios instance with retry interceptors for a deployment.
 */
function createClient(deployment: ModelDeployment): AxiosInstance {
    const client = axios.create({
        timeout: deployment.timeout || 30_000,
    });

    // Response interceptor for rate-limit (429) retry with backoff
    client.interceptors.response.use(undefined, async (error) => {
        if (error.response?.status === 429) {
            const retryAfter = error.response.headers["retry-after"];
            const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
            await new Promise((r) => setTimeout(r, delay));
            return client.request(error.config);
        }
        throw error;
    });

    return client;
}

function estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
}

function buildMessages(request: ChatRequest): Message[] {
    if (request.messages) return request.messages;
    return [{ role: "user", content: request.prompt || "" }];
}

// ------- OpenAI Provider -------

export async function openaiChat(
    deployment: ModelDeployment,
    request: ChatRequest
): Promise<ChatResponse> {
    const client = createClient(deployment);
    const url = (deployment.apiBase || "https://api.openai.com/v1") + "/chat/completions";
    const messages = buildMessages(request);

    const response = await retry(
        async () => {
            return client.post(
                url,
                {
                    model: request.model || deployment.model,
                    messages,
                    max_tokens: request.maxTokens || 256,
                    temperature: request.temperature ?? 0.7,
                    frequency_penalty: request.frequencyPenalty ?? 0,
                },
                {
                    headers: {
                        Authorization: `Bearer ${deployment.apiKey}`,
                        "Content-Type": "application/json",
                        ...(deployment.orgId ? { "OpenAI-Organization": deployment.orgId } : {}),
                    },
                }
            );
        },
        { maxAttempts: deployment.maxRetries || 3, delay: 200 }
    );

    const choice = response.data.choices[0];
    const apiUsage = response.data.usage;

    return {
        content: choice.message.content,
        model: response.data.model,
        provider: "openai",
        usage: {
            promptTokens: apiUsage?.prompt_tokens || 0,
            completionTokens: apiUsage?.completion_tokens || 0,
            totalTokens: apiUsage?.total_tokens || 0,
        },
    };
}

export async function* openaiStreamChat(
    deployment: ModelDeployment,
    request: ChatRequest
): AsyncGenerator<StreamChunk> {
    const url = (deployment.apiBase || "https://api.openai.com/v1") + "/chat/completions";
    const messages = buildMessages(request);

    const response = await axios.post(
        url,
        {
            model: request.model || deployment.model,
            messages,
            max_tokens: request.maxTokens || 256,
            temperature: request.temperature ?? 0.7,
            stream: true,
        },
        {
            headers: {
                Authorization: `Bearer ${deployment.apiKey}`,
                "Content-Type": "application/json",
                ...(deployment.orgId ? { "OpenAI-Organization": deployment.orgId } : {}),
            },
            responseType: "stream",
            timeout: deployment.timeout || 30_000,
        }
    );

    let buffer = "";
    for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") {
                yield { content: "", done: true };
                return;
            }
            try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                    yield { content: delta, done: false };
                }
            } catch {
                // Skip malformed chunks
            }
        }
    }
    yield { content: "", done: true };
}

// ------- Gemini Provider -------

export async function geminiChat(
    deployment: ModelDeployment,
    request: ChatRequest
): Promise<ChatResponse> {
    const client = createClient(deployment);
    const model = request.model || deployment.model;
    const url =
        (deployment.apiBase || "https://generativelanguage.googleapis.com/v1") +
        `/models/${model}:generateContent`;
    const messages = buildMessages(request);

    const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
    }));

    const response = await retry(
        async () => {
            return client.post(
                url,
                {
                    contents,
                    generationConfig: {
                        maxOutputTokens: request.maxTokens || 256,
                        temperature: request.temperature ?? 0.7,
                    },
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": deployment.apiKey,
                    },
                }
            );
        },
        { maxAttempts: deployment.maxRetries || 3, delay: 200 }
    );

    const candidate = response.data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || "";
    const usageMeta = response.data.usageMetadata;

    return {
        content: text,
        model,
        provider: "gemini",
        usage: {
            promptTokens: usageMeta?.promptTokenCount || 0,
            completionTokens: usageMeta?.candidatesTokenCount || 0,
            totalTokens: usageMeta?.totalTokenCount || 0,
        },
    };
}

export async function* geminiStreamChat(
    deployment: ModelDeployment,
    request: ChatRequest
): AsyncGenerator<StreamChunk> {
    const model = request.model || deployment.model;
    const url =
        (deployment.apiBase || "https://generativelanguage.googleapis.com/v1") +
        `/models/${model}:streamGenerateContent?alt=sse`;
    const messages = buildMessages(request);

    const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
    }));

    const response = await axios.post(
        url,
        {
            contents,
            generationConfig: {
                maxOutputTokens: request.maxTokens || 256,
                temperature: request.temperature ?? 0.7,
            },
        },
        {
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": deployment.apiKey,
            },
            responseType: "stream",
            timeout: deployment.timeout || 30_000,
        }
    );

    let buffer = "";
    for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            try {
                const parsed = JSON.parse(trimmed.slice(6));
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (text) {
                    yield { content: text, done: false };
                }
            } catch {
                // Skip
            }
        }
    }
    yield { content: "", done: true };
}

// ------- Cohere Provider -------

export async function cohereChat(
    deployment: ModelDeployment,
    request: ChatRequest
): Promise<ChatResponse> {
    const client = createClient(deployment);
    const url = (deployment.apiBase || "https://api.cohere.ai/v1") + "/chat";
    const messages = buildMessages(request);
    const lastMsg = messages[messages.length - 1];
    const chatHistory = messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "CHATBOT" : "USER",
        message: m.content,
    }));

    const response = await retry(
        async () => {
            return client.post(
                url,
                {
                    model: request.model || deployment.model,
                    message: lastMsg.content,
                    chat_history: chatHistory.length > 0 ? chatHistory : undefined,
                    max_tokens: request.maxTokens || 256,
                    temperature: request.temperature ?? 0.7,
                },
                {
                    headers: {
                        Authorization: `Bearer ${deployment.apiKey}`,
                        "Content-Type": "application/json",
                    },
                }
            );
        },
        { maxAttempts: deployment.maxRetries || 3, delay: 200 }
    );

    const text = response.data.text || "";
    const meta = response.data.meta;
    const billedTokens = meta?.billed_units;

    return {
        content: text,
        model: request.model || deployment.model,
        provider: "cohere",
        usage: {
            promptTokens: billedTokens?.input_tokens || estimateTokens(lastMsg.content),
            completionTokens: billedTokens?.output_tokens || estimateTokens(text),
            totalTokens:
                (billedTokens?.input_tokens || 0) + (billedTokens?.output_tokens || 0) ||
                estimateTokens(lastMsg.content) + estimateTokens(text),
        },
    };
}

export async function* cohereStreamChat(
    deployment: ModelDeployment,
    request: ChatRequest
): AsyncGenerator<StreamChunk> {
    const url = (deployment.apiBase || "https://api.cohere.ai/v1") + "/chat";
    const messages = buildMessages(request);
    const lastMsg = messages[messages.length - 1];
    const chatHistory = messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "CHATBOT" : "USER",
        message: m.content,
    }));

    const response = await axios.post(
        url,
        {
            model: request.model || deployment.model,
            message: lastMsg.content,
            chat_history: chatHistory.length > 0 ? chatHistory : undefined,
            max_tokens: request.maxTokens || 256,
            temperature: request.temperature ?? 0.7,
            stream: true,
        },
        {
            headers: {
                Authorization: `Bearer ${deployment.apiKey}`,
                "Content-Type": "application/json",
            },
            responseType: "stream",
            timeout: deployment.timeout || 30_000,
        }
    );

    let buffer = "";
    for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed.event_type === "text-generation") {
                    yield { content: parsed.text || "", done: false };
                } else if (parsed.event_type === "stream-end" || parsed.is_finished) {
                    yield { content: "", done: true };
                    return;
                }
            } catch {
                // Skip
            }
        }
    }
    yield { content: "", done: true };
}

// ------- Provider dispatch -------

export function chatForProvider(
    deployment: ModelDeployment,
    request: ChatRequest
): Promise<ChatResponse> {
    switch (deployment.provider) {
        case "openai":
            return openaiChat(deployment, request);
        case "gemini":
            return geminiChat(deployment, request);
        case "cohere":
            return cohereChat(deployment, request);
        default:
            throw new Error(`Unsupported provider: ${deployment.provider}`);
    }
}

export function streamForProvider(
    deployment: ModelDeployment,
    request: ChatRequest
): AsyncGenerator<StreamChunk> {
    switch (deployment.provider) {
        case "openai":
            return openaiStreamChat(deployment, request);
        case "gemini":
            return geminiStreamChat(deployment, request);
        case "cohere":
            return cohereStreamChat(deployment, request);
        default:
            throw new Error(`Unsupported provider: ${deployment.provider}`);
    }
}

import axios from "axios";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatModel, role } from "../../types/index";

const DEFAULT_OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_PALM_CHAT_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
const DEFAULT_COHERE_CHAT_URL = "https://api.cohere.ai/v1/chat";

type ProviderKind = "openai" | "palm" | "cohere";

export interface MessageOption {
    role: role;
    content: string;
    name?: string;
}

export interface RouterRoute {
    id?: string;
    provider?: ProviderKind;
    url?: string;
    apiKey?: string;
    orgId?: string;
    model?: string;
    role?: role;
    temperature?: number;
    max_tokens?: number;
    priority?: number;
    retryDelay?: number;
    maxRetries?: number;
    headers?: Record<string, string>;
}

interface OpenAIConstructionOptions {
    url: string;
    apiKey?: string;
    orgId?: string;
    model?: ChatModel | string;
    role?: role;
    temperature?: number;
    routes?: RouterRoute[];
}

interface OpenAIChatOptions {
    model?: ChatModel | string;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    messages?: MessageOption[];
    frequency_penalty?: number;
    stream?: boolean;
}

interface chatWithFunctionOptions extends OpenAIChatOptions {
    functions?: object | Array<object>;
    function_call?: string;
}

interface ZodSchemaResponseOptions<S extends z.ZodTypeAny> extends OpenAIChatOptions {
    prompt: string;
    schema: S;
}

interface chatWithFunctionReturnOptions {
    content: string;
    function_call?: {
        name: string;
        arguments: string;
    };
}

interface OpenAIChatReturnOptions {
    content: string;
}

interface RouteMetrics {
    usedTokens: number;
    failures: number;
    lastLatencyMs: number;
    lastUsedAt: number;
}

type RequestKind = "chat" | "embeddings" | "function" | "schema";

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageContent(messages?: MessageOption[]): string {
    if (!messages || messages.length === 0) return "";
    return messages[messages.length - 1]?.content || "";
}

function normalizeMessages(
    prompt?: string,
    roleValue: role = "user",
    messages?: MessageOption[]
): MessageOption[] {
    if (prompt) {
        return [{ role: roleValue, content: prompt }];
    }
    return messages || [];
}

function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.trim().length / 4));
}

function cohereHistory(messages: MessageOption[]): {
    message: string;
    chat_history: Array<{ role: "USER" | "CHATBOT"; message: string }>;
} {
    const history = messages.slice(0, -1).map((entry) => ({
        role: entry.role === "assistant" ? ("CHATBOT" as const) : ("USER" as const),
        message: entry.content,
    }));
    return {
        message: messages[messages.length - 1]?.content || "",
        chat_history: history,
    };
}

function palmContents(messages: MessageOption[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
    }));
}

async function readStreamToText(stream: any): Promise<string> {
    if (!stream) return "";

    const decoder = new TextDecoder();
    let buffer = "";
    let collected = "";

    for await (const chunk of stream) {
        buffer += decoder.decode(chunk as Buffer, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            if (!line.startsWith("data:")) continue;

            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
                const parsed = JSON.parse(payload);
                const choice = parsed?.choices?.[0];
                const delta = choice?.delta?.content ?? choice?.message?.content ?? "";
                collected += delta;
            } catch {
                collected += payload;
            }
        }
    }

    return collected;
}

export class OpenAiEndpoint {
    apiKey: string;
    orgId: string;
    model: string;
    role: role;
    temperature: number;
    url: string;
    routes: RouterRoute[];
    private metrics: Map<string, RouteMetrics>;

    constructor(options: OpenAIConstructionOptions);
    constructor(
        url: string,
        apiKey?: string,
        orgId?: string,
        model?: ChatModel | string,
        role?: role,
        temperature?: number,
        routes?: RouterRoute[]
    );
    constructor(
        urlOrOptions: string | OpenAIConstructionOptions,
        apiKey?: string,
        orgId?: string,
        model?: ChatModel | string,
        roleValue?: role,
        temperature?: number,
        routes?: RouterRoute[]
    ) {
        const options =
            typeof urlOrOptions === "string"
                ? {
                      url: urlOrOptions,
                      apiKey,
                      orgId,
                      model,
                      role: roleValue,
                      temperature,
                      routes,
                  }
                : urlOrOptions;

        this.url = options.url;
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || "";
        this.orgId = options.orgId || process.env.OPENAI_ORG_ID || "";
        this.model = String(options.model || "gpt-3.5-turbo");
        this.role = options.role || "user";
        this.temperature = options.temperature || 0.7;
        this.routes = this.normalizeRoutes(options.routes);
        this.metrics = new Map();
        this.checkKeys();
    }

    private normalizeRoutes(routes?: RouterRoute[]): RouterRoute[] {
        const normalized = (routes && routes.length > 0 ? routes : [this.baseRoute()]).map((route) => ({
            provider: route.provider || "openai",
            url: route.url || this.url,
            apiKey: route.apiKey || this.apiKey,
            orgId: route.orgId || this.orgId,
            model: route.model || this.model,
            role: route.role || this.role,
            temperature: route.temperature ?? this.temperature,
            max_tokens: route.max_tokens,
            priority: route.priority ?? 0,
            retryDelay: route.retryDelay ?? 200,
            maxRetries: route.maxRetries ?? 1,
            headers: route.headers || {},
            id: route.id || `${route.provider || "openai"}:${route.url || this.url}`,
        }));
        return normalized;
    }

    private baseRoute(): RouterRoute {
        return {
            provider: "openai",
            url: this.url || DEFAULT_OPENAI_CHAT_URL,
            apiKey: this.apiKey,
            orgId: this.orgId,
            model: this.model,
            role: this.role,
            temperature: this.temperature,
        };
    }

    private checkKeys(): void {
        if (!this.apiKey && this.routes.some((route) => route.provider === "openai")) {
            console.error(
                "API key is missing. Please provide a valid OpenAI API key. You can add it in .env file as OPENAI_API_KEY"
            );
        }
        if (!this.orgId) {
            console.warn(
                "Organization ID is missing. Please provide a valid OpenAI Organization ID. You can add it in .env file as OPENAI_ORG_ID"
            );
        }
    }

    private routeMetrics(route: RouterRoute): RouteMetrics {
        const key = route.id || `${route.provider}:${route.url}`;
        const existing = this.metrics.get(key);
        if (existing) return existing;
        const created = {
            usedTokens: 0,
            failures: 0,
            lastLatencyMs: 0,
            lastUsedAt: 0,
        };
        this.metrics.set(key, created);
        return created;
    }

    private chooseRoutes(kind: RequestKind): RouterRoute[] {
        const routes = this.routes.filter((route) => {
            if (kind === "embeddings") return route.provider === "openai" || !!route.url?.includes("/embeddings");
            return true;
        });

        return routes
            .slice()
            .sort((left, right) => {
                const leftMetrics = this.routeMetrics(left);
                const rightMetrics = this.routeMetrics(right);
                const leftScore = leftMetrics.failures * 100000 + leftMetrics.usedTokens + (left.priority || 0) * 10;
                const rightScore =
                    rightMetrics.failures * 100000 + rightMetrics.usedTokens + (right.priority || 0) * 10;
                return leftScore - rightScore;
            });
    }

    private async withRetry<T>(kind: RequestKind, runner: (route: RouterRoute) => Promise<T>): Promise<T> {
        let lastError: unknown;
        const routes = this.chooseRoutes(kind);

        for (const route of routes) {
            const maxRetries = route.maxRetries ?? 1;
            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                const startedAt = Date.now();
                try {
                    const result = await runner(route);
                    const metrics = this.routeMetrics(route);
                    metrics.lastLatencyMs = Date.now() - startedAt;
                    metrics.lastUsedAt = Date.now();
                    return result;
                } catch (error) {
                    lastError = error;
                    const metrics = this.routeMetrics(route);
                    metrics.failures += 1;
                    metrics.lastLatencyMs = Date.now() - startedAt;
                    metrics.lastUsedAt = Date.now();
                    if (attempt < maxRetries) {
                        await delay(route.retryDelay ?? 200);
                        continue;
                    }
                    break;
                }
            }
        }

        throw lastError instanceof Error ? lastError : new Error("All routes failed.");
    }

    private buildHeaders(route: RouterRoute): Record<string, string> {
        const headers: Record<string, string> = {
            "content-type": "application/json",
            ...(route.headers || {}),
        };

        if (route.provider === "palm") {
            headers["x-goog-api-key"] = route.apiKey || this.apiKey;
        } else if (route.provider === "cohere") {
            headers.Authorization = `Bearer ${route.apiKey || this.apiKey}`;
        } else {
            headers.Authorization = `Bearer ${route.apiKey || this.apiKey}`;
            headers["OpenAI-Organization"] = route.orgId || this.orgId;
        }

        return headers;
    }

    private buildChatRequest(route: RouterRoute, chatOptions: OpenAIChatOptions, stream: boolean) {
        const messages = normalizeMessages(chatOptions.prompt, chatOptions.role || route.role || this.role, chatOptions.messages);
        const temperature = chatOptions.temperature ?? route.temperature ?? this.temperature;
        const maxTokens = chatOptions.max_tokens ?? route.max_tokens ?? 256;
        const model = String(chatOptions.model || route.model || this.model);

        if (route.provider === "palm") {
            const url = route.url || DEFAULT_PALM_CHAT_URL.replace("gemini-pro", model);
            return {
                url,
                body: {
                    contents: palmContents(messages),
                    generationConfig: {
                        temperature,
                        maxOutputTokens: maxTokens,
                    },
                },
                headers: this.buildHeaders(route),
                parse: (payload: any) => {
                    const candidate = payload?.candidates?.[0];
                    const content = candidate?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
                    const usage = payload?.usageMetadata?.totalTokenCount || estimateTokens(content);
                    return { content, usage };
                },
            };
        }

        if (route.provider === "cohere") {
            const url = route.url || DEFAULT_COHERE_CHAT_URL;
            const coerced = cohereHistory(messages);
            return {
                url,
                body: {
                    model,
                    message: coerced.message,
                    chat_history: coerced.chat_history,
                    temperature,
                    max_tokens: maxTokens,
                    stream,
                },
                headers: this.buildHeaders(route),
                parse: (payload: any) => {
                    const content = payload?.text || payload?.generations?.[0]?.text || "";
                    const usage =
                        payload?.meta?.tokens?.input_tokens + payload?.meta?.tokens?.output_tokens ||
                        estimateTokens(content);
                    return { content, usage };
                },
            };
        }

        const url = route.url || DEFAULT_OPENAI_CHAT_URL;
        return {
            url,
            body: {
                model,
                messages,
                max_tokens: maxTokens,
                temperature,
                frequency_penalty: chatOptions.frequency_penalty ?? 1,
                stream,
                functions: (chatOptions as chatWithFunctionOptions).functions,
                function_call: (chatOptions as chatWithFunctionOptions).function_call,
            },
            headers: this.buildHeaders(route),
            parse: (payload: any) => {
                const choice = payload?.choices?.[0];
                const content = choice?.message?.content || choice?.delta?.content || "";
                const usage = payload?.usage?.total_tokens || estimateTokens(content);
                return { content, usage, function_call: choice?.message?.function_call };
            },
        };
    }

    private async performChat(
        route: RouterRoute,
        chatOptions: OpenAIChatOptions,
        stream: boolean
    ): Promise<chatWithFunctionReturnOptions> {
        const request = this.buildChatRequest(route, chatOptions, stream);
        const response = await axios.post(request.url, request.body, {
            headers: request.headers,
            responseType: stream && route.provider === "openai" ? "stream" : "json",
        });

        if (stream && route.provider === "openai") {
            const content = await readStreamToText(response.data);
            const usage = estimateTokens(content);
            this.routeMetrics(route).usedTokens += usage;
            return { content };
        }

        const parsed = request.parse(response.data);
        this.routeMetrics(route).usedTokens += parsed.usage || estimateTokens(parsed.content);
        return {
            content: parsed.content,
            function_call: parsed.function_call,
        };
    }

    private async performEmbeddings(
        route: RouterRoute,
        input: string[],
        model: string
    ): Promise<number[][]> {
        if (route.provider !== "openai") {
            throw new Error(`Embeddings are only supported for OpenAI-compatible routes. Route ${route.id || route.url} is ${route.provider}.`);
        }

        const response = await axios.post(
            route.url?.includes("/embeddings") ? route.url : DEFAULT_OPENAI_EMBEDDINGS_URL,
            {
                model,
                input,
            },
            {
                headers: this.buildHeaders(route),
            }
        );

        const data = response.data?.data || [];
        const embeddings = Array.isArray(data)
            ? data.map((entry: { embedding?: number[] }) => entry.embedding || [])
            : data?.embedding
              ? [data.embedding]
              : [];

        this.routeMetrics(route).usedTokens += estimateTokens(input.join(" "));
        return embeddings;
    }

    async chat(chatOptions: OpenAIChatOptions): Promise<OpenAIChatReturnOptions> {
        return this.withRetry("chat", async (route) => this.performChat(route, chatOptions, false));
    }

    async streamedChat(chatOptions: OpenAIChatOptions): Promise<OpenAIChatReturnOptions> {
        return this.withRetry("chat", async (route) => this.performChat(route, { ...chatOptions, stream: true }, true));
    }

    async chatWithFunction(
        chatOptions: chatWithFunctionOptions
    ): Promise<chatWithFunctionReturnOptions> {
        return this.withRetry("function", async (route) => this.performChat(route, chatOptions, false));
    }

    async generateEmbeddings({ input, model }: { input: string[]; model: string }): Promise<number[][]> {
        return this.withRetry("embeddings", async (route) => this.performEmbeddings(route, input, model));
    }

    async zodSchemaResponse<S extends z.ZodTypeAny>(
        chatOptions: ZodSchemaResponseOptions<S>
    ): Promise<S | string> {
        const jsonSchema = zodToJsonSchema(chatOptions.schema, { $refStrategy: "none" });
        const openAIFunctionCallDefinition = {
            name: "generateSchema",
            description: "Generate a schema based on provided details.",
            parameters: jsonSchema,
        };

        const content = `
                        You are a Schema generator that can generate answer based on given prompt and then return the response based on the give schema 
                        Remembrer if any field like url or link is not available please create a dummy link based on the following prompt
                        
                        prompt:
                        ${chatOptions.prompt || ""}
                        `;

        const response = await this.chatWithFunction({
            ...chatOptions,
            prompt: content,
            functions: [openAIFunctionCallDefinition],
            function_call: "auto",
        });

        if (response.content) {
            return response.content;
        }

        if (response.function_call?.arguments) {
            return chatOptions.schema.parse(JSON.parse(response.function_call.arguments));
        }

        throw new Error("Response did not contain valid JSON.");
    }

    async gptFn(prompt: string): Promise<string> {
        const response = await this.chat({ prompt });
        return response.content;
    }

    async gptFnChat(messages: MessageOption[]): Promise<string> {
        const response = await this.chat({ messages });
        return response.content;
    }

    async gptFnTestGenerator(prompt: string): Promise<string> {
        return this.gptFn(prompt);
    }

    async embeddings(input: string): Promise<number[][]> {
        return this.generateEmbeddings({ input: [input], model: "text-embedding-ada-002" });
    }
}


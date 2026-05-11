import axios from "axios";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProviderName = "openai" | "gemini" | "llama" | "cohere";

interface MessageOption {
    role: "user" | "assistant" | "system";
    content: string;
}

interface SmartRouterOptions {
    openaiApiKey?: string;
    geminiApiKey?: string;
    llamaApiKey?: string;
    cohereApiKey?: string;
    /** Override routing priority. Defaults to openai → gemini → llama → cohere */
    fallbackChain?: ProviderName[];
}

interface SmartRouterChatOptions {
    model: string;
    prompt?: string;
    messages?: MessageOption[];
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface SmartRouterChatResult {
    content: string;
    provider: ProviderName;
    model: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

const PROVIDER_PATTERNS: Record<ProviderName, RegExp> = {
    openai: /^(gpt-|o1-|o3-|chatgpt-|text-embedding-|dall-e-)/i,
    gemini: /^(gemini-|palm-|bison-)/i,
    llama: /^(llama-|meta-llama\/|mixtral-|mistral-|qwen-|deepseek-)/i,
    cohere: /^(command-|cohere-)/i,
};

function detectProvider(model: string): ProviderName | null {
    for (const [provider, pattern] of Object.entries(PROVIDER_PATTERNS) as [ProviderName, RegExp][]) {
        if (pattern.test(model)) return provider;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Per-provider chat implementations
// ---------------------------------------------------------------------------

async function chatOpenAI(
    model: string,
    messages: MessageOption[],
    options: SmartRouterChatOptions,
    apiKey: string
): Promise<SmartRouterChatResult> {
    const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
            model,
            messages,
            max_tokens: options.max_tokens ?? 256,
            temperature: options.temperature ?? 0.7,
            stream: false,
        },
        { headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" } }
    );
    const choice = response.data.choices[0];
    return {
        content: choice.message.content,
        provider: "openai",
        model,
        usage: response.data.usage
            ? {
                  prompt_tokens: response.data.usage.prompt_tokens,
                  completion_tokens: response.data.usage.completion_tokens,
                  total_tokens: response.data.usage.total_tokens,
              }
            : undefined,
    };
}

async function chatGemini(
    model: string,
    messages: MessageOption[],
    options: SmartRouterChatOptions,
    apiKey: string
): Promise<SmartRouterChatResult> {
    const geminiModel = model.startsWith("gemini-") ? model : "gemini-pro";
    const url = `https://generativelanguage.googleapis.com/v1/models/${geminiModel}:generateContent?key=${apiKey}`;
    const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const response = await axios.post(
        url,
        { contents, generationConfig: { maxOutputTokens: options.max_tokens ?? 256, temperature: options.temperature ?? 0.7 } },
        { headers: { "content-type": "application/json" } }
    );
    const candidate = response.data.candidates[0];
    const usage = response.data.usageMetadata;
    return {
        content: candidate.content.parts[0].text,
        provider: "gemini",
        model: geminiModel,
        usage: usage
            ? {
                  prompt_tokens: usage.promptTokenCount ?? 0,
                  completion_tokens: usage.candidatesTokenCount ?? 0,
                  total_tokens: usage.totalTokenCount ?? 0,
              }
            : undefined,
    };
}

async function chatLlama(
    model: string,
    messages: MessageOption[],
    options: SmartRouterChatOptions,
    apiKey: string
): Promise<SmartRouterChatResult> {
    const response = await axios.post(
        "https://api.llama-api.com/chat/completions",
        {
            model: model || "llama-13b-chat",
            messages,
            max_tokens: options.max_tokens ?? 256,
            temperature: options.temperature ?? 0.7,
        },
        { headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" } }
    );
    const choice = response.data.choices[0];
    return {
        content: choice.message.content,
        provider: "llama",
        model,
        usage: response.data.usage
            ? {
                  prompt_tokens: response.data.usage.prompt_tokens,
                  completion_tokens: response.data.usage.completion_tokens,
                  total_tokens: response.data.usage.total_tokens,
              }
            : undefined,
    };
}

async function chatCohere(
    model: string,
    messages: MessageOption[],
    options: SmartRouterChatOptions,
    apiKey: string
): Promise<SmartRouterChatResult> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const chatHistory = messages
        .slice(0, -1)
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "CHATBOT" : "USER", message: m.content }));

    const response = await axios.post(
        "https://api.cohere.ai/v1/chat",
        {
            model: model || "command-r",
            message: lastUser?.content ?? "",
            chat_history: chatHistory,
            max_tokens: options.max_tokens ?? 256,
            temperature: options.temperature ?? 0.7,
        },
        { headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" } }
    );
    const meta = response.data.meta?.tokens;
    return {
        content: response.data.text,
        provider: "cohere",
        model: model || "command-r",
        usage: meta
            ? {
                  prompt_tokens: meta.input_tokens ?? 0,
                  completion_tokens: meta.output_tokens ?? 0,
                  total_tokens: (meta.input_tokens ?? 0) + (meta.output_tokens ?? 0),
              }
            : undefined,
    };
}

// ---------------------------------------------------------------------------
// SmartRouter
// ---------------------------------------------------------------------------

export class SmartRouter {
    private keys: Record<ProviderName, string>;
    private fallbackChain: ProviderName[];

    constructor(options: SmartRouterOptions = {}) {
        this.keys = {
            openai: options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? "",
            gemini: options.geminiApiKey ?? process.env.GEMINI_API_KEY ?? "",
            llama: options.llamaApiKey ?? process.env.LLAMA_API_KEY ?? "",
            cohere: options.cohereApiKey ?? process.env.COHERE_API_KEY ?? "",
        };
        this.fallbackChain = options.fallbackChain ?? ["openai", "gemini", "llama", "cohere"];
    }

    detectProvider(model: string): ProviderName | null {
        return detectProvider(model);
    }

    isModelSupported(model: string): boolean {
        return detectProvider(model) !== null;
    }

    listProviders(): ProviderName[] {
        return ["openai", "gemini", "llama", "cohere"];
    }

    private buildMessages(options: SmartRouterChatOptions): MessageOption[] {
        if (options.messages) return options.messages;
        if (options.prompt) return [{ role: "user", content: options.prompt }];
        throw new Error("SmartRouter.chat requires either `prompt` or `messages`");
    }

    private async callProvider(
        provider: ProviderName,
        model: string,
        messages: MessageOption[],
        options: SmartRouterChatOptions
    ): Promise<SmartRouterChatResult> {
        const key = this.keys[provider];
        if (!key) throw new Error(`No API key configured for provider: ${provider}`);

        switch (provider) {
            case "openai":
                return chatOpenAI(model, messages, options, key);
            case "gemini":
                return chatGemini(model, messages, options, key);
            case "llama":
                return chatLlama(model, messages, options, key);
            case "cohere":
                return chatCohere(model, messages, options, key);
        }
    }

    async chat(options: SmartRouterChatOptions): Promise<SmartRouterChatResult> {
        const messages = this.buildMessages(options);
        const primary = detectProvider(options.model);

        // Build attempt list: primary provider first, then fallback chain order
        const order: ProviderName[] = primary
            ? [primary, ...this.fallbackChain.filter((p) => p !== primary)]
            : [...this.fallbackChain];

        const errors: string[] = [];
        for (const provider of order) {
            if (!this.keys[provider]) continue;
            try {
                return await this.callProvider(provider, options.model, messages, options);
            } catch (err: any) {
                const msg = err?.response?.data?.error?.message ?? err?.message ?? String(err);
                errors.push(`${provider}: ${msg}`);
            }
        }

        throw new Error(
            `SmartRouter: all providers failed.\n${errors.join("\n")}`
        );
    }
}

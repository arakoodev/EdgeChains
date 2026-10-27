import type { role } from "../../types/index.js";
import { calculateTokenUsage } from "./tokenUsage.js";
import type {
    DeploymentConfig,
    RouterCompletionOptions,
    RouterCompletionResponse,
    RouterMessage,
} from "./types.js";

export interface BuiltProviderRequest {
    url: string;
    headers: Record<string, string>;
    body: Record<string, any>;
    normalizedMessages: RouterMessage[];
    promptText: string;
}

export function normalizeMessages(options: RouterCompletionOptions): RouterMessage[] {
    if (options.messages && options.messages.length > 0) {
        return options.messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.name ? { name: m.name } : {}),
        }));
    }
    return [
        {
            role: options.role || "user",
            content: options.prompt || "",
        },
    ];
}

export function buildProviderRequest(
    deployment: DeploymentConfig,
    options: RouterCompletionOptions
): BuiltProviderRequest {
    const normalizedMessages = normalizeMessages(options);
    const promptText =
        options.prompt || normalizedMessages.map((m) => m.content).join("\n");
    const provider = deployment.provider;

    if (provider === "openai") {
        const url = deployment.endpoint || "https://api.openai.com/v1/chat/completions";
        const headers: Record<string, string> = {
            Authorization: "Bearer " + deployment.apiKey,
            "content-type": "application/json",
            "OpenAI-Organization": deployment.orgId || "",
        };
        const openAiMessages = normalizedMessages.map((m) => ({
            role: (m.role === "agent" ? "assistant" : m.role) as role,
            content: m.content,
            ...(m.name ? { name: m.name } : {}),
        }));

        const body: Record<string, any> = {
            model: deployment.model || options.model || deployment.modelName || "gpt-3.5-turbo",
            messages: openAiMessages,
            max_tokens: options.max_tokens ?? (options.functions ? 1024 : 256),
            temperature: options.temperature ?? 0.7,
        };
        if (!options.functions) {
            body.frequency_penalty = options.frequency_penalty ?? 1;
        } else {
            body.functions = options.functions;
            body.function_call = options.function_call || "auto";
        }
        if (options.stream) {
            body.stream = true;
        }
        return { url, headers, body, normalizedMessages, promptText };
    }

    if (provider === "palm" || provider === "google-palm" || provider === "gemini") {
        const rawModel =
            deployment.model || options.model || deployment.modelName || "chat-bison-001";
        const cleanModel = rawModel.replace(/^models\//, "");
        const isGemini =
            provider === "gemini" ||
            cleanModel.startsWith("gemini") ||
            Boolean(deployment.endpoint && deployment.endpoint.includes("generateContent"));

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "x-goog-api-key": deployment.apiKey,
        };

        if (isGemini) {
            const url =
                deployment.endpoint ||
                `https://generativelanguage.googleapis.com/v1/models/${cleanModel}:generateContent`;
            const body: Record<string, any> = {
                contents: normalizedMessages.map((m) => ({
                    role: m.role === "assistant" || m.role === "agent" ? "model" : "user",
                    parts: [{ text: m.content }],
                })),
                generationConfig: {
                    temperature: options.temperature ?? 0.7,
                    maxOutputTokens: options.max_tokens ?? 256,
                },
            };
            return { url, headers, body, normalizedMessages, promptText };
        }

        const isTextBison = cleanModel.includes("text-bison");
        const methodSuffix = isTextBison ? "generateText" : "generateMessage";
        const url =
            deployment.endpoint ||
            `https://generativelanguage.googleapis.com/v1beta2/models/${cleanModel}:${methodSuffix}?key=${deployment.apiKey}`;
        const body: Record<string, any> = isTextBison
            ? {
                  prompt: { text: promptText },
                  temperature: options.temperature ?? 0.7,
                  maxOutputTokens: options.max_tokens ?? 256,
              }
            : {
                  prompt: {
                      messages: normalizedMessages.map((m) => ({
                          author: m.role === "assistant" || m.role === "agent" ? "1" : "0",
                          content: m.content,
                      })),
                  },
                  temperature: options.temperature ?? 0.7,
                  candidateCount: 1,
              };
        return { url, headers, body, normalizedMessages, promptText };
    }

    if (provider === "cohere") {
        const url = deployment.endpoint || "https://api.cohere.ai/v1/chat";
        const headers: Record<string, string> = {
            Authorization: `Bearer ${deployment.apiKey}`,
            "Content-Type": "application/json",
        };
        const lastMsg = normalizedMessages[normalizedMessages.length - 1] || {
            role: "user",
            content: promptText,
        };
        const history = normalizedMessages.slice(0, -1).map((m) => ({
            role: m.role === "assistant" || m.role === "agent" ? "CHATBOT" : "USER",
            message: m.content,
        }));
        const body: Record<string, any> = {
            model: deployment.model || options.model || deployment.modelName || "command",
            message: lastMsg.content,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 256,
        };
        if (history.length > 0) {
            body.chat_history = history;
        }
        if (options.stream) {
            body.stream = true;
        }
        return { url, headers, body, normalizedMessages, promptText };
    }

    throw new Error(`Unsupported LLM provider: ${provider}`);
}

export function parseProviderResponse(
    deploymentId: string,
    deployment: DeploymentConfig,
    options: RouterCompletionOptions,
    rawData: any
): RouterCompletionResponse {
    const normalizedMessages = normalizeMessages(options);
    const provider = deployment.provider;
    const model = deployment.model || options.model || deployment.modelName;

    let content = "";
    let functionCall: { name: string; arguments: string } | undefined;
    let choices: RouterCompletionResponse["choices"] = [];

    if (provider === "openai") {
        const rawChoices = Array.isArray(rawData?.choices) ? rawData.choices : [];
        if (rawChoices.length > 0) {
            choices = rawChoices.map((c: any, idx: number) => {
                const msg = c.message || c.delta || {};
                const msgContent = typeof msg.content === "string" ? msg.content : "";
                const fnCall = msg.function_call;
                return {
                    index: typeof c.index === "number" ? c.index : idx,
                    message: {
                        role: (msg.role || "assistant") as role,
                        content: msgContent,
                        ...(fnCall ? { function_call: fnCall } : {}),
                    },
                    finish_reason: c.finish_reason || "stop",
                };
            });
            content = choices[0].message.content;
            functionCall = choices[0].message.function_call;
        } else if (typeof rawData?.content === "string") {
            content = rawData.content;
        }
    } else if (provider === "palm" || provider === "google-palm" || provider === "gemini") {
        const candidates = Array.isArray(rawData?.candidates) ? rawData.candidates : [];
        if (candidates.length > 0) {
            const first = candidates[0];
            if (typeof first.output === "string") {
                content = first.output;
            } else if (typeof first.content === "string") {
                content = first.content;
            } else if (Array.isArray(first.content?.parts)) {
                content = first.content.parts.map((p: any) => p.text || "").join("");
            }
        } else if (typeof rawData?.text === "string") {
            content = rawData.text;
        }
    } else if (provider === "cohere") {
        if (typeof rawData?.text === "string") {
            content = rawData.text;
        } else if (Array.isArray(rawData?.generations) && rawData.generations.length > 0) {
            content = rawData.generations[0].text || "";
        } else if (typeof rawData?.message?.content === "string") {
            content = rawData.message.content;
        }
    }

    if (choices.length === 0) {
        choices = [
            {
                index: 0,
                message: {
                    role: "assistant",
                    content,
                    ...(functionCall ? { function_call: functionCall } : {}),
                },
                finish_reason: "stop",
            },
        ];
    }

    const usage = calculateTokenUsage({
        provider,
        rawResponse: rawData,
        prompt: options.prompt,
        messages: normalizedMessages,
        completionText: content,
    });

    return {
        id: rawData?.id || rawData?.generation_id || `${provider}-${Date.now()}`,
        provider,
        model,
        deploymentId,
        content,
        role: "assistant",
        ...(functionCall ? { function_call: functionCall } : {}),
        choices,
        usage,
        raw: rawData,
    };
}

/**
 * Extracts text deltas from SSE streams, JSON chunk arrays, or provider responses.
 */
export function extractStreamDeltas(provider: DeploymentConfig["provider"], rawData: any): string[] {
    if (!rawData) {
        return [];
    }

    if (typeof rawData === "string") {
        const lines = rawData
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        const deltas: string[] = [];
        for (const line of lines) {
            const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
            if (!payload || payload === "[DONE]") {
                continue;
            }
            try {
                const parsed = JSON.parse(payload);
                deltas.push(...extractStreamDeltas(provider, parsed));
            } catch {
                deltas.push(payload);
            }
        }
        return deltas;
    }

    if (Array.isArray(rawData)) {
        const deltas: string[] = [];
        for (const item of rawData) {
            deltas.push(...extractStreamDeltas(provider, item));
        }
        return deltas;
    }

    if (typeof rawData === "object") {
        if (Array.isArray(rawData.choices) && rawData.choices.length > 0) {
            const out: string[] = [];
            for (const choice of rawData.choices) {
                const deltaText =
                    choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? "";
                if (deltaText) {
                    out.push(String(deltaText));
                }
            }
            return out;
        }
        if (typeof rawData.text === "string" && rawData.text.length > 0) {
            return [rawData.text];
        }
        if (Array.isArray(rawData.candidates) && rawData.candidates.length > 0) {
            const first = rawData.candidates[0];
            if (typeof first.content === "string") {
                return [first.content];
            }
            if (typeof first.output === "string") {
                return [first.output];
            }
            if (Array.isArray(first.content?.parts)) {
                return first.content.parts.map((p: any) => String(p.text || "")).filter(Boolean);
            }
        }
    }

    return [];
}

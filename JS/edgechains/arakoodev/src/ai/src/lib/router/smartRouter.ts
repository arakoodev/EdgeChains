import axios, { AxiosRequestConfig } from "axios";

export type SmartRouterProvider = "openai" | "google_palm" | "cohere";

export interface SmartRouterMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface SmartRouterUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface SmartRouterDeployment {
    id: string;
    provider: SmartRouterProvider;
    model: string;
    apiKey: string;
    baseUrl?: string;
    rpmLimit?: number;
    tpmLimit?: number;
    timeoutMs?: number;
    maxRetries?: number;
}

export interface SmartRouterChatOptions {
    model?: string;
    prompt?: string;
    messages?: SmartRouterMessage[];
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface SmartRouterResponse {
    deploymentId: string;
    provider: SmartRouterProvider;
    model: string;
    content: string;
    usage: SmartRouterUsage;
    raw: any;
}

export interface SmartRouterEvent {
    deployment: SmartRouterDeployment;
    options: SmartRouterChatOptions;
    response?: SmartRouterResponse;
    error?: any;
    latencyMs: number;
}

export interface SmartRouterCallback {
    on_success?: (event: SmartRouterEvent) => void;
    on_failure?: (event: SmartRouterEvent) => void;
}

type SmartRouterTransport = (
    config: AxiosRequestConfig,
) => Promise<{ data: any; status?: number }>;

interface DeploymentState {
    minute: number;
    requests: number;
    tokens: number;
    totalTokens: number;
    cooldownUntil: number;
}

interface SmartRouterOptions {
    deployments: SmartRouterDeployment[];
    transport?: SmartRouterTransport;
    now?: () => number;
}

const EMPTY_USAGE: SmartRouterUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
};

export class SmartRouter {
    private deployments: SmartRouterDeployment[];
    private states = new Map<string, DeploymentState>();
    private callbacks: SmartRouterCallback[] = [];
    private transport: SmartRouterTransport;
    private now: () => number;

    constructor({
        deployments,
        transport,
        now = () => Date.now(),
    }: SmartRouterOptions) {
        if (!deployments.length) {
            throw new Error("SmartRouter requires at least one deployment.");
        }

        this.deployments = deployments;
        this.transport =
            transport ||
            ((config) =>
                axios
                    .request(config)
                    .then(({ data, status }) => ({ data, status })));
        this.now = now;

        deployments.forEach((deployment) => {
            this.states.set(deployment.id, this.freshState());
        });
    }

    addCallback(callback: SmartRouterCallback) {
        this.callbacks.push(callback);
    }

    getUsage(deploymentId: string): SmartRouterUsage {
        const state = this.states.get(deploymentId);
        return {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: state?.totalTokens || 0,
        };
    }

    async chat(
        options: SmartRouterChatOptions,
    ): Promise<SmartRouterResponse | AsyncIterable<string>> {
        const maxAttempts = this.deployments.length;
        const attempted = new Set<string>();
        let lastError: any;

        for (
            let attempt = 0;
            attempt < maxAttempts && attempted.size < this.deployments.length;
            attempt++
        ) {
            const deployment = this.pickDeployment(options.model, attempted);
            attempted.add(deployment.id);
            const startedAt = this.now();

            try {
                const response = await this.callDeployment(deployment, options);
                const normalized = this.normalizeResponse(
                    deployment,
                    response.data,
                );
                const latencyMs = this.now() - startedAt;

                this.recordUsage(deployment.id, normalized.usage);
                this.emitSuccess({
                    deployment,
                    options,
                    response: normalized,
                    latencyMs,
                });

                if (options.stream) {
                    return this.toAsyncIterable(response.data);
                }

                return normalized;
            } catch (error: any) {
                lastError = error;
                const latencyMs = this.now() - startedAt;

                if (this.isRateLimited(error)) {
                    this.cooldown(deployment.id);
                }

                this.emitFailure({ deployment, options, error, latencyMs });

                if (!this.shouldRetry(error)) {
                    break;
                }
            }
        }

        throw (
            lastError ||
            new Error("No available deployment for SmartRouter request.")
        );
    }

    private pickDeployment(model?: string, attempted = new Set<string>()) {
        this.refreshWindows();
        const now = this.now();
        const candidates = this.deployments
            .filter((deployment) => !attempted.has(deployment.id))
            .filter((deployment) => !model || deployment.model === model)
            .filter((deployment) => {
                const state =
                    this.states.get(deployment.id) || this.freshState();
                return (
                    state.cooldownUntil <= now &&
                    (!deployment.rpmLimit ||
                        state.requests < deployment.rpmLimit) &&
                    (!deployment.tpmLimit || state.tokens < deployment.tpmLimit)
                );
            })
            .sort((a, b) => {
                const aState = this.states.get(a.id) || this.freshState();
                const bState = this.states.get(b.id) || this.freshState();
                return aState.totalTokens - bState.totalTokens;
            });

        if (!candidates.length) {
            throw new Error(
                "No SmartRouter deployments are currently below their limits.",
            );
        }

        return candidates[0];
    }

    private async callDeployment(
        deployment: SmartRouterDeployment,
        options: SmartRouterChatOptions,
    ) {
        const config = this.toAxiosConfig(deployment, options);
        const state = this.states.get(deployment.id) || this.freshState();
        state.requests += 1;
        this.states.set(deployment.id, state);
        return this.transport(config);
    }

    private toAxiosConfig(
        deployment: SmartRouterDeployment,
        options: SmartRouterChatOptions,
    ): AxiosRequestConfig {
        const messages = options.prompt
            ? [{ role: "user", content: options.prompt }]
            : options.messages || [];

        if (deployment.provider === "google_palm") {
            return {
                method: "post",
                url:
                    deployment.baseUrl ||
                    `https://generativelanguage.googleapis.com/v1/models/${deployment.model}:generateContent`,
                timeout: deployment.timeoutMs,
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": deployment.apiKey,
                },
                data: {
                    contents: messages.map((message) => ({
                        role: message.role === "assistant" ? "model" : "user",
                        parts: [{ text: message.content }],
                    })),
                    generationConfig: {
                        temperature: options.temperature,
                        maxOutputTokens: options.max_tokens,
                    },
                },
            };
        }

        if (deployment.provider === "cohere") {
            return {
                method: "post",
                url: deployment.baseUrl || "https://api.cohere.ai/v1/chat",
                timeout: deployment.timeoutMs,
                headers: {
                    Authorization: `Bearer ${deployment.apiKey}`,
                    "Content-Type": "application/json",
                },
                data: {
                    model: deployment.model,
                    message: messages
                        .map((message) => message.content)
                        .join("\n"),
                    temperature: options.temperature,
                    max_tokens: options.max_tokens,
                    stream: options.stream || false,
                },
            };
        }

        return {
            method: "post",
            url:
                deployment.baseUrl ||
                "https://api.openai.com/v1/chat/completions",
            timeout: deployment.timeoutMs,
            headers: {
                Authorization: `Bearer ${deployment.apiKey}`,
                "Content-Type": "application/json",
            },
            data: {
                model: deployment.model,
                messages,
                max_tokens: options.max_tokens,
                temperature: options.temperature,
                stream: options.stream || false,
            },
        };
    }

    private normalizeResponse(
        deployment: SmartRouterDeployment,
        raw: any,
    ): SmartRouterResponse {
        const content = this.extractContent(deployment.provider, raw);
        const usage = this.extractUsage(deployment.provider, raw);

        return {
            deploymentId: deployment.id,
            provider: deployment.provider,
            model: deployment.model,
            content,
            usage,
            raw,
        };
    }

    private extractContent(provider: SmartRouterProvider, raw: any): string {
        if (typeof raw === "string") {
            return raw.includes("data:")
                ? this.parseSseDeltas(raw).join("")
                : raw;
        }

        if (provider === "google_palm") {
            return (
                raw?.candidates?.[0]?.content?.parts
                    ?.map((part) => part.text)
                    .join("") || ""
            );
        }

        if (provider === "cohere") {
            return raw?.text || raw?.message?.content?.[0]?.text || "";
        }

        return (
            raw?.choices?.[0]?.message?.content ||
            raw?.choices?.[0]?.delta?.content ||
            ""
        );
    }

    private extractUsage(
        provider: SmartRouterProvider,
        raw: any,
    ): SmartRouterUsage {
        if (raw?.usage) {
            return {
                prompt_tokens: raw.usage.prompt_tokens || 0,
                completion_tokens: raw.usage.completion_tokens || 0,
                total_tokens: raw.usage.total_tokens || 0,
            };
        }

        if (provider === "google_palm" && raw?.usageMetadata) {
            return {
                prompt_tokens: raw.usageMetadata.promptTokenCount || 0,
                completion_tokens: raw.usageMetadata.candidatesTokenCount || 0,
                total_tokens: raw.usageMetadata.totalTokenCount || 0,
            };
        }

        const billedUnits = raw?.meta?.billed_units || raw?.meta?.tokens;
        if (provider === "cohere" && billedUnits) {
            const promptTokens = billedUnits.input_tokens || 0;
            const completionTokens = billedUnits.output_tokens || 0;
            return {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
            };
        }

        return EMPTY_USAGE;
    }

    private recordUsage(deploymentId: string, usage: SmartRouterUsage) {
        const state = this.states.get(deploymentId) || this.freshState();
        state.tokens += usage.total_tokens;
        state.totalTokens += usage.total_tokens;
        this.states.set(deploymentId, state);
    }

    private refreshWindows() {
        const minute = this.currentMinute();
        this.states.forEach((state) => {
            if (state.minute !== minute) {
                state.minute = minute;
                state.requests = 0;
                state.tokens = 0;
            }
        });
    }

    private cooldown(deploymentId: string) {
        const state = this.states.get(deploymentId) || this.freshState();
        state.cooldownUntil = this.now() + 60 * 1000;
        this.states.set(deploymentId, state);
    }

    private shouldRetry(error: any) {
        const status = error?.response?.status || error?.status;
        return status === 429 || status >= 500;
    }

    private isRateLimited(error: any) {
        return (error?.response?.status || error?.status) === 429;
    }

    private parseSseDeltas(payload: string) {
        return payload
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.replace(/^data:\s*/, ""))
            .filter((line) => line && line !== "[DONE]")
            .map((line) => JSON.parse(line))
            .map(
                (event) =>
                    event?.choices?.[0]?.delta?.content || event?.text || "",
            )
            .filter(Boolean);
    }

    private async *toAsyncIterable(content: string): AsyncIterable<string> {
        const chunks = content.includes("data:")
            ? this.parseSseDeltas(content)
            : [content];
        for (const chunk of chunks) {
            yield chunk;
        }
    }

    private emitSuccess(event: SmartRouterEvent) {
        this.callbacks.forEach((callback) => callback.on_success?.(event));
    }

    private emitFailure(event: SmartRouterEvent) {
        this.callbacks.forEach((callback) => callback.on_failure?.(event));
    }

    private freshState(): DeploymentState {
        return {
            minute: this.currentMinute(),
            requests: 0,
            tokens: 0,
            totalTokens: 0,
            cooldownUntil: 0,
        };
    }

    private currentMinute() {
        return Math.floor(this.now() / 60000);
    }
}

export function sentryCallback(sentry: {
    captureException: (error: any, context?: any) => void;
}) {
    return {
        on_failure: (event: SmartRouterEvent) =>
            sentry.captureException(event.error, {
                tags: {
                    provider: event.deployment.provider,
                    deploymentId: event.deployment.id,
                },
            }),
    };
}

export function posthogCallback(posthog: { capture: (event: any) => void }) {
    return {
        on_success: (event: SmartRouterEvent) =>
            posthog.capture({
                event: "smart_router_success",
                properties: {
                    provider: event.deployment.provider,
                    deploymentId: event.deployment.id,
                    latencyMs: event.latencyMs,
                    totalTokens: event.response?.usage.total_tokens || 0,
                },
            }),
        on_failure: (event: SmartRouterEvent) =>
            posthog.capture({
                event: "smart_router_failure",
                properties: {
                    provider: event.deployment.provider,
                    deploymentId: event.deployment.id,
                    latencyMs: event.latencyMs,
                    error: event.error?.message || String(event.error),
                },
            }),
    };
}

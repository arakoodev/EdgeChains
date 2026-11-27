import axios, { AxiosInstance } from "axios";
import {
    DeploymentConfig,
    DeploymentStats,
    ObservabilityCallback,
    ObservabilityEvent,
    RouterChatOptions,
    RouterChatResponse,
    RouterConfig,
    StreamChunk,
    TokenUsage,
} from "./types.js";

export class SmartRouter {
    private deployments: DeploymentConfig[];
    private stats: Map<string, DeploymentStats> = new Map();
    private routingStrategy: "least-tokens" | "round-robin";
    private maxRetries: number;
    private timeoutMs: number;
    private cooldownPeriodMs: number;
    private callbacks: ObservabilityCallback[] = [];
    private roundRobinIndex: number = 0;
    private axiosInstance: AxiosInstance;
    private sentryClient?: any;
    private posthogClient?: any;

    constructor(config: RouterConfig, customAxios?: AxiosInstance) {
        if (!config.deployments || config.deployments.length === 0) {
            throw new Error("SmartRouter requires at least one deployment configuration.");
        }
        this.deployments = config.deployments;
        this.routingStrategy = config.routingStrategy || "least-tokens";
        this.maxRetries = config.maxRetries ?? 2;
        this.timeoutMs = config.timeoutMs ?? 15000;
        this.cooldownPeriodMs = config.cooldownPeriodMs ?? 30000;
        this.callbacks = config.callbacks || [];
        this.sentryClient = config.sentryClient;
        this.posthogClient = config.posthogClient;

        for (const dep of this.deployments) {
            this.stats.set(dep.id, {
                totalTokens: 0,
                promptTokens: 0,
                completionTokens: 0,
                requestCount: 0,
                failureCount: 0,
                isCoolingDown: false,
            });
        }

        this.axiosInstance = customAxios || axios.create({ timeout: this.timeoutMs });
    }

    public getDeploymentStats(deploymentId: string): DeploymentStats | undefined {
        return this.stats.get(deploymentId);
    }

    public getAllStats(): Map<string, DeploymentStats> {
        return new Map(this.stats);
    }

    public selectDeployment(filterModel?: string): DeploymentConfig {
        const now = Date.now();
        // Check cooldown expiries
        for (const [depId, stat] of this.stats.entries()) {
            if (stat.isCoolingDown && stat.lastFailureTime) {
                if (now - stat.lastFailureTime > this.cooldownPeriodMs) {
                    stat.isCoolingDown = false;
                    stat.failureCount = 0;
                }
            }
        }

        const candidates = this.deployments.filter((d) => {
            const stat = this.stats.get(d.id);
            if (stat && stat.isCoolingDown) return false;
            if (filterModel && d.model !== filterModel) return false;
            return true;
        });

        if (candidates.length === 0) {
            // Fallback: use any matching deployment even if cooling down
            const fallback = filterModel
                ? this.deployments.filter((d) => d.model === filterModel)
                : this.deployments;
            if (fallback.length === 0) {
                throw new Error(`No available deployments found for model filter: ${filterModel}`);
            }
            return fallback[0];
        }

        if (this.routingStrategy === "round-robin") {
            const selected = candidates[this.roundRobinIndex % candidates.length];
            this.roundRobinIndex++;
            return selected;
        }

        // Default: least-tokens
        candidates.sort((a, b) => {
            const statA = this.stats.get(a.id)?.totalTokens || 0;
            const statB = this.stats.get(b.id)?.totalTokens || 0;
            return statA - statB;
        });

        return candidates[0];
    }

    private async emitEvent(event: ObservabilityEvent): Promise<void> {
        for (const cb of this.callbacks) {
            try {
                await cb(event);
            } catch (err) {
                // Ignore observer callback errors
            }
        }

        if (event.type === "failure" && this.sentryClient && event.error) {
            try {
                this.sentryClient.captureException(event.error);
            } catch (e) {}
        } else if (event.type === "success" && this.sentryClient) {
            try {
                this.sentryClient.addBreadcrumb({
                    category: "llm",
                    message: `LLM call to ${event.provider}:${event.model} completed in ${event.latencyMs}ms`,
                    level: "info",
                });
            } catch (e) {}
        }

        if (this.posthogClient && (event.type === "success" || event.type === "failure")) {
            try {
                this.posthogClient.capture({
                    distinctId: "edgechains-router",
                    event: "llm_completion",
                    properties: {
                        deploymentId: event.deploymentId,
                        provider: event.provider,
                        model: event.model,
                        tokens: event.usage?.total_tokens || 0,
                        latencyMs: event.latencyMs,
                        status: event.type,
                    },
                });
            } catch (e) {}
        }
    }

    public async chat(options: RouterChatOptions): Promise<RouterChatResponse> {
        let attempts = 0;
        const maxAttempts = Math.max(1, this.maxRetries + 1);
        const triedDeploymentIds = new Set<string>();

        while (attempts < maxAttempts) {
            attempts++;
            // Select deployment excluding ones that just failed in this turn if alternatives exist
            let deployment = this.selectDeployment(options.model);
            if (triedDeploymentIds.has(deployment.id)) {
                const untried = this.deployments.filter((d) => !triedDeploymentIds.has(d.id));
                if (untried.length > 0) {
                    deployment = untried[0];
                }
            }
            triedDeploymentIds.add(deployment.id);

            const startTime = Date.now();
            await this.emitEvent({
                type: "start",
                deploymentId: deployment.id,
                provider: deployment.provider,
                model: deployment.model,
            });

            try {
                const response = await this.executeCall(deployment, options);
                const latencyMs = Date.now() - startTime;
                response.latencyMs = latencyMs;

                // Update stats
                const stat = this.stats.get(deployment.id)!;
                stat.requestCount++;
                stat.promptTokens += response.usage.prompt_tokens;
                stat.completionTokens += response.usage.completion_tokens;
                stat.totalTokens += response.usage.total_tokens;

                await this.emitEvent({
                    type: "success",
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    usage: response.usage,
                    latencyMs,
                });

                return response;
            } catch (error: any) {
                const latencyMs = Date.now() - startTime;
                const stat = this.stats.get(deployment.id)!;
                stat.failureCount++;
                stat.lastFailureTime = Date.now();

                // If status is 429 (rate limit) or 5xx, mark cooldown for failover
                const statusCode = error?.response?.status;
                if (statusCode === 429 || (statusCode && statusCode >= 500)) {
                    stat.isCoolingDown = true;
                }

                await this.emitEvent({
                    type: "failure",
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    latencyMs,
                    error,
                });

                if (attempts >= maxAttempts) {
                    throw error;
                }
            }
        }

        throw new Error("SmartRouter: all retry and failover attempts exhausted.");
    }

    private async executeCall(
        deployment: DeploymentConfig,
        options: RouterChatOptions
    ): Promise<RouterChatResponse> {
        const messages = options.messages || [
            { role: "user", content: options.prompt || "" },
        ];

        switch (deployment.provider) {
            case "openai":
                return this.callOpenAI(deployment, options, messages);
            case "palm":
                return this.callPalm(deployment, options, messages);
            case "cohere":
                return this.callCohere(deployment, options, messages);
            default:
                throw new Error(`Unsupported provider: ${deployment.provider}`);
        }
    }

    private async callOpenAI(
        deployment: DeploymentConfig,
        options: RouterChatOptions,
        messages: any[]
    ): Promise<RouterChatResponse> {
        const url = (deployment.apiBase || "https://api.openai.com/v1") + "/chat/completions";
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (deployment.apiKey) {
            headers["Authorization"] = `Bearer ${deployment.apiKey}`;
        }

        const resp = await this.axiosInstance.post(
            url,
            {
                model: deployment.model,
                messages,
                max_tokens: options.max_tokens ?? 256,
                temperature: options.temperature ?? 0.7,
            },
            { headers, timeout: deployment.timeoutMs || this.timeoutMs }
        );

        const data = resp.data;
        const content = data.choices?.[0]?.message?.content || "";
        const usage: TokenUsage = {
            prompt_tokens: data.usage?.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4),
            completion_tokens: data.usage?.completion_tokens ?? Math.ceil(content.length / 4),
            total_tokens: data.usage?.total_tokens ?? (Math.ceil(JSON.stringify(messages).length / 4) + Math.ceil(content.length / 4)),
        };

        return {
            content,
            provider: "openai",
            model: deployment.model,
            deploymentId: deployment.id,
            usage,
            latencyMs: 0,
        };
    }

    private async callPalm(
        deployment: DeploymentConfig,
        options: RouterChatOptions,
        messages: any[]
    ): Promise<RouterChatResponse> {
        const baseUrl = deployment.apiBase || "https://generativelanguage.googleapis.com/v1beta";
        const url = `${baseUrl}/models/${deployment.model}:generateContent${deployment.apiKey ? `?key=${deployment.apiKey}` : ""}`;

        const promptText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
        const resp = await this.axiosInstance.post(
            url,
            {
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                    maxOutputTokens: options.max_tokens ?? 256,
                    temperature: options.temperature ?? 0.7,
                },
            },
            {
                headers: { "Content-Type": "application/json" },
                timeout: deployment.timeoutMs || this.timeoutMs,
            }
        );

        const data = resp.data;
        const candidate = data.candidates?.[0];
        const content = candidate?.content?.parts?.[0]?.text || "";
        const promptTokens = data.usageMetadata?.promptTokenCount ?? Math.ceil(promptText.length / 4);
        const completionTokens = data.usageMetadata?.candidatesTokenCount ?? Math.ceil(content.length / 4);

        return {
            content,
            provider: "palm",
            model: deployment.model,
            deploymentId: deployment.id,
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
            },
            latencyMs: 0,
        };
    }

    private async callCohere(
        deployment: DeploymentConfig,
        options: RouterChatOptions,
        messages: any[]
    ): Promise<RouterChatResponse> {
        const baseUrl = deployment.apiBase || "https://api.cohere.ai/v1";
        const url = `${baseUrl}/chat`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (deployment.apiKey) {
            headers["Authorization"] = `Bearer ${deployment.apiKey}`;
        }

        const message = messages[messages.length - 1]?.content || "";
        const resp = await this.axiosInstance.post(
            url,
            {
                model: deployment.model,
                message,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.max_tokens ?? 256,
            },
            { headers, timeout: deployment.timeoutMs || this.timeoutMs }
        );

        const data = resp.data;
        const content = data.text || "";
        const promptTokens = data.meta?.tokens?.input_tokens ?? Math.ceil(message.length / 4);
        const completionTokens = data.meta?.tokens?.output_tokens ?? Math.ceil(content.length / 4);

        return {
            content,
            provider: "cohere",
            model: deployment.model,
            deploymentId: deployment.id,
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
            },
            latencyMs: 0,
        };
    }

    public async *chatStream(options: RouterChatOptions): AsyncIterableIterator<StreamChunk> {
        const response = await this.chat(options);
        // Yield tokens in chunks
        const words = response.content.split(" ");
        for (let i = 0; i < words.length; i++) {
            const isLast = i === words.length - 1;
            yield {
                content: words[i] + (isLast ? "" : " "),
                done: isLast,
            };
        }
    }
}

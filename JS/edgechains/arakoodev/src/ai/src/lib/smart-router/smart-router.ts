import type {
    ChatRequest,
    ChatResponse,
    DeploymentStats,
    LoggingCallback,
    ModelDeployment,
    RouterConfig,
    StreamChunk,
    TokenUsage,
} from "./types.js";
import { chatForProvider, streamForProvider } from "./providers.js";
import { UsageTracker } from "./usage-tracker.js";
import { LoggingManager } from "./logging.js";

export class SmartRouter {
    private deployments: ModelDeployment[];
    private strategy: "least-tokens" | "round-robin" | "fallback";
    private defaultMaxTokens: number;
    private defaultTemperature: number;
    private retryDelayMs: number;
    private roundRobinIndex = 0;
    private usageTracker: UsageTracker;
    private loggingManager: LoggingManager;

    constructor(config: RouterConfig) {
        if (!config.deployments || config.deployments.length === 0) {
            throw new Error("SmartRouter requires at least one deployment");
        }
        this.deployments = config.deployments;
        this.strategy = config.strategy || "least-tokens";
        this.defaultMaxTokens = config.defaultMaxTokens || 256;
        this.defaultTemperature = config.defaultTemperature ?? 0.7;
        this.retryDelayMs = config.retryDelayMs || 1000;
        this.usageTracker = new UsageTracker();
        this.loggingManager = new LoggingManager();

        if (config.callbacks) {
            for (const cb of config.callbacks) {
                this.loggingManager.addCallback(cb);
            }
        }
    }

    /**
     * Load router config from a parsed jsonnet/JSON object.
     */
    static fromConfig(config: any): SmartRouter {
        const deployments: ModelDeployment[] = (config.deployments || []).map((d: any) => ({
            provider: d.provider,
            apiKey: d.api_key || d.apiKey || "",
            model: d.model,
            apiBase: d.api_base || d.apiBase,
            orgId: d.org_id || d.orgId,
            maxRetries: d.max_retries || d.maxRetries || 3,
            timeout: d.timeout || 30000,
            rpmLimit: d.rpm_limit || d.rpmLimit,
            tpmLimit: d.tpm_limit || d.tpmLimit,
        }));

        return new SmartRouter({
            deployments,
            strategy: config.strategy || "least-tokens",
            defaultMaxTokens: config.default_max_tokens || config.defaultMaxTokens,
            defaultTemperature: config.default_temperature ?? config.defaultTemperature,
            retryDelayMs: config.retry_delay_ms || config.retryDelayMs,
        });
    }

    /**
     * Pick the best deployment based on the routing strategy.
     */
    private selectDeployment(): ModelDeployment {
        const available = this.deployments.filter((d) =>
            this.usageTracker.isWithinRateLimit(d)
        );

        if (available.length === 0) {
            // All rate-limited — fall back to first deployment
            return this.deployments[0];
        }

        switch (this.strategy) {
            case "round-robin": {
                const idx = this.roundRobinIndex % available.length;
                this.roundRobinIndex++;
                return available[idx];
            }
            case "fallback": {
                // Always prefer first available
                return available[0];
            }
            case "least-tokens":
            default: {
                // Pick the deployment with the least tokens used
                let best = available[0];
                let bestTokens = this.usageTracker.getStats(best).totalTokensUsed;

                for (let i = 1; i < available.length; i++) {
                    const tokens = this.usageTracker.getStats(available[i]).totalTokensUsed;
                    if (tokens < bestTokens) {
                        best = available[i];
                        bestTokens = tokens;
                    }
                }
                return best;
            }
        }
    }

    /**
     * Send a chat completion request with automatic routing, retries, and fallback.
     */
    async chat(request: ChatRequest): Promise<ChatResponse> {
        const req: ChatRequest = {
            ...request,
            maxTokens: request.maxTokens || this.defaultMaxTokens,
            temperature: request.temperature ?? this.defaultTemperature,
        };

        const errors: Error[] = [];

        // Try each deployment in priority order
        for (let attempt = 0; attempt < this.deployments.length; attempt++) {
            const deployment = attempt === 0 ? this.selectDeployment() : this.deployments[attempt];
            const startTime = Date.now();

            this.loggingManager.onStart(req, deployment);

            try {
                const response = await chatForProvider(deployment, req);
                const durationMs = Date.now() - startTime;

                this.usageTracker.record(deployment, response.usage);
                this.loggingManager.onSuccess(req, response, durationMs);

                return response;
            } catch (error: any) {
                this.usageTracker.recordFailure(deployment);
                this.loggingManager.onError(req, error, deployment);
                errors.push(error);

                // Wait before trying next deployment
                if (attempt < this.deployments.length - 1) {
                    await new Promise((r) => setTimeout(r, this.retryDelayMs));
                }
            }
        }

        throw new Error(
            `All deployments failed. Errors:\n${errors.map((e) => e.message).join("\n")}`
        );
    }

    /**
     * Stream a chat completion with automatic routing.
     */
    async *streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
        const req: ChatRequest = {
            ...request,
            maxTokens: request.maxTokens || this.defaultMaxTokens,
            temperature: request.temperature ?? this.defaultTemperature,
            stream: true,
        };

        const deployment = this.selectDeployment();
        this.loggingManager.onStart(req, deployment);
        const startTime = Date.now();

        try {
            const stream = streamForProvider(deployment, req);
            let fullContent = "";

            for await (const chunk of stream) {
                fullContent += chunk.content;
                yield chunk;
            }

            // Estimate usage for streamed responses
            const promptText =
                request.prompt || request.messages?.map((m) => m.content).join(" ") || "";
            const usage: TokenUsage = {
                promptTokens: Math.ceil(promptText.length / 4),
                completionTokens: Math.ceil(fullContent.length / 4),
                totalTokens: Math.ceil((promptText.length + fullContent.length) / 4),
            };

            this.usageTracker.record(deployment, usage);
            this.loggingManager.onSuccess(
                req,
                { content: fullContent, model: deployment.model, provider: deployment.provider, usage },
                Date.now() - startTime
            );
        } catch (error: any) {
            this.usageTracker.recordFailure(deployment);
            this.loggingManager.onError(req, error, deployment);
            throw error;
        }
    }

    /**
     * Add a logging callback (Sentry, PostHog, or custom).
     */
    addCallback(callback: LoggingCallback): void {
        this.loggingManager.addCallback(callback);
    }

    /**
     * Get token usage statistics for all deployments.
     */
    getUsageStats(): DeploymentStats[] {
        return this.usageTracker.getAllStats();
    }

    /**
     * Get total token usage across all deployments.
     */
    getTotalUsage(): TokenUsage {
        return this.usageTracker.getTotalUsage();
    }

    /**
     * Reset all usage statistics.
     */
    resetUsage(): void {
        this.usageTracker.reset();
    }
}

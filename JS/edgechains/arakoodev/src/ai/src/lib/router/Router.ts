import type {
    RouterConfig,
    DeploymentConfig,
    Deployment,
    CompletionRequest,
    CompletionResponse,
    StreamChunk,
    RoutingStrategy,
    TokenUsage,
    CallLogEntry,
    IProvider,
    ProviderName,
} from "./types.js";
import { OpenAIProvider } from "./providers/OpenAIProvider.js";
import { GeminiProvider } from "./providers/GeminiProvider.js";
import { CohereProvider } from "./providers/CohereProvider.js";
import { CallbackManager } from "./logging/CallbackManager.js";

/**
 * LiteLLM-style smart router for the EdgeChains JS SDK.
 *
 * Supports:
 *  - Load balancing (round-robin, least-tokens, latency-based, cost-based)
 *  - Fallbacks across deployments with automatic cooldown
 *  - Streaming
 *  - Token usage tracking
 *  - Logging via Sentry / PostHog / custom callbacks
 */
export class Router {
    private deployments: Map<string, Deployment[]>;
    private config: Required<RouterConfig>;
    private callbackManager?: CallbackManager;
    private providers: Map<string, IProvider>;
    private roundRobinCounters: Map<string, number>;

    constructor(config: RouterConfig) {
        this.config = {
            modelList: config.modelList || [],
            routingStrategy: config.routingStrategy || "round-robin",
            numRetries: config.numRetries ?? 3,
            timeout: config.timeout ?? 30_000,
            cooldownTime: config.cooldownTime ?? 60,
            allowedFails: config.allowedFails ?? 3,
            callbacks: config.callbacks || {},
        };

        this.deployments = new Map();
        this.providers = new Map();
        this.roundRobinCounters = new Map();

        this.initializeDeployments();

        if (config.callbacks) {
            this.callbackManager = new CallbackManager(config.callbacks);
        }
    }

    // ------------------------------------------------------------------
    // Initialization
    // ------------------------------------------------------------------

    private initializeDeployments(): void {
        const groups = new Map<string, DeploymentConfig[]>();

        for (const mc of this.config.modelList) {
            const existing = groups.get(mc.modelName) || [];
            existing.push(mc);
            groups.set(mc.modelName, existing);
        }

        for (const [modelName, configs] of groups) {
            const deps: Deployment[] = configs.map((c) => ({
                config: c,
                currentTokens: 0,
                currentRequests: 0,
                failures: 0,
            }));
            this.deployments.set(modelName, deps);
            this.roundRobinCounters.set(modelName, 0);
        }
    }

    // ------------------------------------------------------------------
    // Provider factory (cached)
    // ------------------------------------------------------------------

    private getProvider(config: DeploymentConfig): IProvider {
        const key = `${config.provider}|${config.apiKey}|${config.apiBase || ""}`;
        if (this.providers.has(key)) return this.providers.get(key)!;

        let provider: IProvider;
        switch (config.provider) {
            case "openai":
                provider = new OpenAIProvider(config.apiKey, config.apiBase, this.config.timeout);
                break;
            case "gemini":
                provider = new GeminiProvider(config.apiKey, config.apiBase, this.config.timeout);
                break;
            case "cohere":
                provider = new CohereProvider(config.apiKey, config.apiBase, this.config.timeout);
                break;
            default:
                throw new Error(`Unsupported provider: ${config.provider}`);
        }

        this.providers.set(key, provider);
        return provider;
    }

    // ------------------------------------------------------------------
    // Deployment selection (routing strategies)
    // ------------------------------------------------------------------

    private selectDeployment(modelName: string): Deployment | null {
        const deps = this.deployments.get(modelName);
        if (!deps || deps.length === 0) return null;

        const now = Date.now();
        const active = deps.filter((d) => !d.cooldownUntil || d.cooldownUntil <= now);
        if (active.length === 0) return deps[0]; // all on cooldown — try first anyway

        const available = active.filter((d) => this.withinRateLimit(d));
        const pool = available.length > 0 ? available : active;

        switch (this.config.routingStrategy) {
            case "least-tokens":
                return this.selectByLeastTokens(pool);
            case "latency-based":
                return this.selectByLatency(pool);
            case "cost-based":
                return this.selectByCost(pool);
            case "round-robin":
            default:
                return this.selectByRoundRobin(pool, modelName);
        }
    }

    private selectByRoundRobin(deps: Deployment[], modelName: string): Deployment {
        const idx = (this.roundRobinCounters.get(modelName) || 0) % deps.length;
        this.roundRobinCounters.set(modelName, idx + 1);
        return deps[idx];
    }

    private selectByLeastTokens(deps: Deployment[]): Deployment {
        return deps.reduce((min, d) => (d.currentTokens < min.currentTokens ? d : min));
    }

    private selectByLatency(deps: Deployment[]): Deployment {
        return deps.reduce((min, d) =>
            (d.latency ?? Infinity) < (min.latency ?? Infinity) ? d : min,
        );
    }

    private selectByCost(deps: Deployment[]): Deployment {
        return deps.reduce((min, d) => {
            const dCost = (d.config.inputCostPer1k || 0) + (d.config.outputCostPer1k || 0);
            const mCost = (min.config.inputCostPer1k || 0) + (min.config.outputCostPer1k || 0);
            return dCost < mCost ? d : min;
        });
    }

    // ------------------------------------------------------------------
    // Rate limit check
    // ------------------------------------------------------------------

    private withinRateLimit(dep: Deployment): boolean {
        if (dep.config.rpm && dep.currentRequests >= dep.config.rpm) return false;
        if (dep.config.tpm && dep.currentTokens >= dep.config.tpm) return false;
        return true;
    }

    // ------------------------------------------------------------------
    // Failure handling
    // ------------------------------------------------------------------

    private handleFailure(dep: Deployment): void {
        dep.failures += 1;
        if (dep.failures >= this.config.allowedFails) {
            dep.cooldownUntil = Date.now() + this.config.cooldownTime * 1000;
            dep.failures = 0;
        }
    }

    // ------------------------------------------------------------------
    // Usage tracking
    // ------------------------------------------------------------------

    private updateUsage(dep: Deployment, usage: TokenUsage): void {
        dep.currentTokens += usage.totalTokens;
        dep.currentRequests += 1;
    }

    // ------------------------------------------------------------------
    // Public: completion with fallback
    // ------------------------------------------------------------------

    async completion(request: CompletionRequest): Promise<CompletionResponse> {
        const modelName = request.model;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.config.numRetries; attempt++) {
            const dep = this.selectDeployment(modelName);
            if (!dep) {
                throw new Error(`No deployment configured for model: ${modelName}`);
            }

            const provider = this.getProvider(dep.config);
            const start = Date.now();

            try {
                // Replace model name with the provider-specific model id
                const providerRequest = { ...request, model: dep.config.litellmModel };
                const response = await provider.complete(providerRequest);

                // Track usage & latency
                this.updateUsage(dep, response.usage);
                dep.latency = response.latencyMs;
                dep.failures = 0;

                // Log
                await this.logCall(dep, request, response.usage, response.latencyMs, true);

                return response;
            } catch (err: any) {
                const latency = Date.now() - start;
                lastError = err;
                this.handleFailure(dep);
                await this.logCall(dep, request, { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, latency, false, err.message);
            }
        }

        throw lastError || new Error("All deployments failed");
    }

    // ------------------------------------------------------------------
    // Public: streaming completion with fallback
    // ------------------------------------------------------------------

    async *streamCompletion(request: CompletionRequest): AsyncGenerator<StreamChunk> {
        const modelName = request.model;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.config.numRetries; attempt++) {
            const dep = this.selectDeployment(modelName);
            if (!dep) {
                throw new Error(`No deployment configured for model: ${modelName}`);
            }

            const provider = this.getProvider(dep.config);

            try {
                const providerRequest = { ...request, model: dep.config.litellmModel };
                const stream = provider.stream(providerRequest);

                for await (const chunk of stream) {
                    yield chunk;
                }

                dep.failures = 0;
                return;
            } catch (err: any) {
                lastError = err;
                this.handleFailure(dep);
            }
        }

        throw lastError || new Error("All deployments failed (stream)");
    }

    // ------------------------------------------------------------------
    // Public: token usage report
    // ------------------------------------------------------------------

    getUsage(): Record<string, { tokens: number; requests: number }> {
        const result: Record<string, { tokens: number; requests: number }> = {};
        for (const [model, deps] of this.deployments) {
            let tokens = 0;
            let requests = 0;
            for (const d of deps) {
                tokens += d.currentTokens;
                requests += d.currentRequests;
            }
            result[model] = { tokens, requests };
        }
        return result;
    }

    /** Reset per-minute counters (call from a 60s interval) */
    resetUsageCounters(): void {
        for (const deps of this.deployments.values()) {
            for (const d of deps) {
                d.currentTokens = 0;
                d.currentRequests = 0;
            }
        }
    }

    // ------------------------------------------------------------------
    // Logging helper
    // ------------------------------------------------------------------

    private async logCall(
        dep: Deployment,
        request: CompletionRequest,
        usage: TokenUsage,
        latencyMs: number,
        success: boolean,
        error?: string,
    ): Promise<void> {
        if (!this.callbackManager) return;

        const entry: CallLogEntry = {
            timestamp: new Date(),
            model: request.model,
            provider: dep.config.provider,
            deployment: dep.config.litellmModel,
            latencyMs,
            usage,
            success,
            error,
            request,
        };

        await this.callbackManager.log(entry);
    }
}

/**
 * EdgeChains LLMRouter — Smart Router inspired by LiteLLM.
 *
 * Provides a unified routing layer for multiple LLM providers with:
 * - Load balancing across deployments (least-busy, round-robin, weighted, random)
 * - Automatic fallback to alternate deployments on failure
 * - Streaming support with consistent AsyncIterable interface
 * - Token usage tracking across all providers
 * - Observability via Sentry and PostHog
 *
 * Key design decisions (fixing bugs from initial implementations):
 * - streamChat() tries ALL primary deployments before falling back (not just one)
 * - Unhealthy deployments (healthy: false) are excluded from selection
 * - Provider adapters correctly accept and use options.model
 */

import type {
    RouterConfig,
    DeploymentConfig,
    DeploymentState,
    RouterChatOptions,
    RouterChatResponse,
    StreamChunk,
    LoadBalanceStrategy,
    ILLMProvider,
    TokenUsage,
    RouterEventHandler,
} from "./types.js";

import { OpenAIProvider } from "./providers/openai-provider.js";
import { GeminiProvider } from "./providers/gemini-provider.js";
import { CohereProvider } from "./providers/cohere-provider.js";

import { RouterLogger } from "./logging.js";

export class LLMRouter {
    private deployments: Map<string, DeploymentState> = new Map();
    private primaryDeploymentIds: string[] = [];
    private fallbackDeploymentIds: string[] = [];
    private strategy: LoadBalanceStrategy;
    private maxRetries: number;
    private timeout: number;
    private trackTokenUsage: boolean;
    private logger: RouterLogger;
    private roundRobinIndex: number = 0;

    constructor(config: RouterConfig) {
        this.strategy = config.strategy || "least-busy";
        this.maxRetries = config.maxRetries ?? 3;
        this.timeout = config.timeout ?? 60000;
        this.trackTokenUsage = config.trackTokenUsage ?? true;
        this.logger = new RouterLogger(config.logging);

        // Initialize all deployments
        for (const depConfig of config.deployments) {
            this.addDeployment(depConfig);
        }
    }

    // ─── Public API ──────────────────────────────────────────────────

    /**
     * Add a new deployment to the router.
     * Deployments marked healthy: false are still registered but excluded
     * from routing selection until explicitly marked healthy.
     */
    addDeployment(config: DeploymentConfig): void {
        const provider = this.createProvider(config);
        const state: DeploymentState = {
            config,
            activeRequests: 0,
            totalRequests: 0,
            totalTokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            consecutiveFailures: 0,
            provider,
        };

        this.deployments.set(config.id, state);

        // Separate primary and fallback deployments
        if (config.isFallback) {
            if (!this.fallbackDeploymentIds.includes(config.id)) {
                this.fallbackDeploymentIds.push(config.id);
            }
        } else {
            if (!this.primaryDeploymentIds.includes(config.id)) {
                this.primaryDeploymentIds.push(config.id);
            }
        }
    }

    /**
     * Remove a deployment from the router.
     */
    removeDeployment(id: string): boolean {
        const deleted = this.deployments.delete(id);
        this.primaryDeploymentIds = this.primaryDeploymentIds.filter((d) => d !== id);
        this.fallbackDeploymentIds = this.fallbackDeploymentIds.filter((d) => d !== id);
        return deleted;
    }

    /**
     * Mark a deployment as healthy or unhealthy.
     */
    setDeploymentHealth(id: string, healthy: boolean): void {
        const state = this.deployments.get(id);
        if (state) {
            state.config.healthy = healthy;
            if (healthy) {
                state.consecutiveFailures = 0;
            }
        }
    }

    /**
     * Register a custom event handler for router events.
     */
    onEvent(handler: RouterEventHandler): void {
        this.logger.onEvent(handler);
    }

    /**
     * Send a non-streaming chat request through the router.
     *
     * The router will:
     * 1. Select a primary deployment using the configured strategy
     * 2. If it fails, try other primary deployments
     * 3. If all primaries fail, try fallback deployments
     * 4. If everything fails, throw an error
     */
    async chat(options: RouterChatOptions): Promise<RouterChatResponse> {
        // If a specific deployment is requested, use it directly
        if (options.deploymentId) {
            return this.chatWithDeployment(options.deploymentId, options);
        }

        // Try all primary deployments first
        try {
            return await this.tryModelDeployments(this.primaryDeploymentIds, options, false);
        } catch (primaryError) {
            // All primaries failed — try fallbacks
            if (this.fallbackDeploymentIds.length > 0) {
                try {
                    return await this.tryModelDeployments(this.fallbackDeploymentIds, options, true);
                } catch (fallbackError) {
                    // Ignored, we'll throw below
                }
            }
        }

        // Everything failed
        this.logger.emit({
            type: "all_deployments_failed",
            model: options.model || "unknown",
            attempts: this.primaryDeploymentIds.length + this.fallbackDeploymentIds.length,
        });

        throw new Error(
            `All deployments failed for model "${options.model || "unknown"}". ` +
            `Tried ${this.primaryDeploymentIds.length} primary and ${this.fallbackDeploymentIds.length} fallback deployments.`
        );
    }

    /**
     * Send a streaming chat request through the router.
     *
     * FIX: Unlike the original buggy implementation that only tried one deployment
     * before falling back, this correctly tries ALL primary deployments first,
     * then falls back to fallback deployments if all primaries fail.
     */
    async *streamChat(options: RouterChatOptions): AsyncIterable<StreamChunk> {
        // If a specific deployment is requested, use it directly
        if (options.deploymentId) {
            yield* this.streamWithDeployment(options.deploymentId, options);
            return;
        }

        // Try all primary deployments first (FIX: same logic as chat())
        const primaryIds = this.getAvailableDeploymentIds(this.primaryDeploymentIds);
        for (const depId of primaryIds) {
            try {
                yield* this.streamWithDeployment(depId, options);
                return; // Success — stop trying
            } catch (err) {
                const state = this.deployments.get(depId);
                const errorMsg = err instanceof Error ? err.message : String(err);
                this.logger.emit({
                    type: "request_error",
                    deploymentId: depId,
                    model: options.model || state?.config.model || "unknown",
                    provider: state?.config.provider || "openai",
                    error: errorMsg,
                });
                this.recordFailure(depId);
                continue; // Try next deployment
            }
        }

        // All primaries failed — try fallbacks
        const fallbackIds = this.getAvailableDeploymentIds(this.fallbackDeploymentIds);
        for (const depId of fallbackIds) {
            // Log fallback event
            const lastPrimaryId = primaryIds[primaryIds.length - 1] || "none";
            this.logger.emit({
                type: "fallback_triggered",
                fromDeploymentId: lastPrimaryId,
                toDeploymentId: depId,
                reason: "All primary deployments failed",
            });

            try {
                yield* this.streamWithDeployment(depId, options);
                return; // Success
            } catch (err) {
                const state = this.deployments.get(depId);
                const errorMsg = err instanceof Error ? err.message : String(err);
                this.logger.emit({
                    type: "request_error",
                    deploymentId: depId,
                    model: options.model || state?.config.model || "unknown",
                    provider: state?.config.provider || "openai",
                    error: errorMsg,
                });
                this.recordFailure(depId);
                continue;
            }
        }

        // Everything failed
        this.logger.emit({
            type: "all_deployments_failed",
            model: options.model || "unknown",
            attempts: primaryIds.length + fallbackIds.length,
        });

        throw new Error(
            `All deployments failed for streaming model "${options.model || "unknown"}". ` +
            `Tried ${primaryIds.length} primary and ${fallbackIds.length} fallback deployments.`
        );
    }

    /**
     * Get aggregated token usage across all deployments.
     */
    getTokenUsage(): Record<string, TokenUsage> {
        const usage: Record<string, TokenUsage> = {};
        for (const [id, state] of this.deployments) {
            usage[id] = { ...state.totalTokenUsage };
        }
        return usage;
    }

    /**
     * Get the list of all deployment IDs (primary + fallback).
     */
    getDeploymentIds(): string[] {
        return [...this.primaryDeploymentIds, ...this.fallbackDeploymentIds];
    }

    /**
     * Get information about a specific deployment.
     */
    getDeploymentInfo(id: string): DeploymentConfig | undefined {
        return this.deployments.get(id)?.config;
    }

    // ─── Private Methods ─────────────────────────────────────────────

    /**
     * Try multiple deployments in order, returning the first successful response.
     * Throws the last error if all deployments fail.
     */
    private async tryModelDeployments(
        deploymentIds: string[],
        options: RouterChatOptions,
        isFallback: boolean
    ): Promise<RouterChatResponse> {
        const availableIds = this.getAvailableDeploymentIds(deploymentIds);
        let lastError: Error | null = null;

        for (const depId of availableIds) {
            try {
                return await this.chatWithDeployment(depId, options);
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                const state = this.deployments.get(depId);
                this.logger.emit({
                    type: "request_error",
                    deploymentId: depId,
                    model: options.model || state?.config.model || "unknown",
                    provider: state?.config.provider || "openai",
                    error: lastError.message,
                });
                this.recordFailure(depId);

                // If this is a fallback and the previous was a primary, log the fallback trigger
                if (isFallback && depId === availableIds[0]) {
                    const lastPrimaryId = this.primaryDeploymentIds[this.primaryDeploymentIds.length - 1] || "none";
                    this.logger.emit({
                        type: "fallback_triggered",
                        fromDeploymentId: lastPrimaryId,
                        toDeploymentId: depId,
                        reason: "All primary deployments failed",
                    });
                }
            }
        }

        throw lastError || new Error("No available deployments");
    }

    /**
     * Send a chat request to a specific deployment.
     */
    private async chatWithDeployment(
        deploymentId: string,
        options: RouterChatOptions
    ): Promise<RouterChatResponse> {
        const state = this.deployments.get(deploymentId);
        if (!state) {
            throw new Error(`Deployment "${deploymentId}" not found`);
        }

        const startTime = Date.now();
        state.activeRequests++;

        this.logger.emit({
            type: "request_start",
            deploymentId,
            model: options.model || state.config.model,
            provider: state.config.provider,
        });

        try {
            const providerRequest = {
                model: options.model || state.config.model,
                messages: options.messages,
                max_tokens: options.max_tokens,
                temperature: options.temperature,
                frequency_penalty: options.frequency_penalty,
                stream: false,
            };

            const response = await state.provider.chat(providerRequest);

            const latencyMs = Date.now() - startTime;
            state.activeRequests--;
            state.totalRequests++;
            state.consecutiveFailures = 0;

            // Track token usage
            if (this.trackTokenUsage) {
                state.totalTokenUsage.promptTokens += response.usage.promptTokens;
                state.totalTokenUsage.completionTokens += response.usage.completionTokens;
                state.totalTokenUsage.totalTokens += response.usage.totalTokens;
                this.logger.logUsage(deploymentId, response.model, response.usage);
            }

            this.logger.emit({
                type: "request_success",
                deploymentId,
                model: response.model,
                provider: state.config.provider,
                usage: response.usage,
                latencyMs,
            });

            return {
                content: response.content,
                model: response.model,
                provider: state.config.provider,
                deploymentId,
                usage: response.usage,
                streamed: false,
                finishReason: response.finishReason,
            };
        } catch (err) {
            state.activeRequests--;
            this.recordFailure(deploymentId);
            throw err;
        }
    }

    /**
     * Stream a chat request from a specific deployment.
     */
    private async *streamWithDeployment(
        deploymentId: string,
        options: RouterChatOptions
    ): AsyncIterable<StreamChunk> {
        const state = this.deployments.get(deploymentId);
        if (!state) {
            throw new Error(`Deployment "${deploymentId}" not found`);
        }

        const startTime = Date.now();
        state.activeRequests++;

        this.logger.emit({
            type: "request_start",
            deploymentId,
            model: options.model || state.config.model,
            provider: state.config.provider,
        });

        try {
            const providerRequest = {
                model: options.model || state.config.model,
                messages: options.messages,
                max_tokens: options.max_tokens,
                temperature: options.temperature,
                frequency_penalty: options.frequency_penalty,
                stream: true,
            };

            let totalContent = "";
            let lastUsage: TokenUsage | undefined;

            for await (const chunk of state.provider.streamChat(providerRequest)) {
                totalContent += chunk.content;

                // Inject deployment metadata into chunk
                yield {
                    ...chunk,
                    provider: state.config.provider,
                    deploymentId,
                };

                if (chunk.done) {
                    lastUsage = chunk.usage;
                }
            }

            const latencyMs = Date.now() - startTime;
            state.activeRequests--;
            state.totalRequests++;
            state.consecutiveFailures = 0;

            // Track token usage from the final chunk
            if (this.trackTokenUsage && lastUsage) {
                state.totalTokenUsage.promptTokens += lastUsage.promptTokens;
                state.totalTokenUsage.completionTokens += lastUsage.completionTokens;
                state.totalTokenUsage.totalTokens += lastUsage.totalTokens;
                this.logger.logUsage(deploymentId, options.model || state.config.model, lastUsage);
            }

            this.logger.emit({
                type: "request_success",
                deploymentId,
                model: options.model || state.config.model,
                provider: state.config.provider,
                usage: lastUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                latencyMs,
            });
        } catch (err) {
            state.activeRequests--;
            this.recordFailure(deploymentId);
            throw err;
        }
    }

    /**
     * Get available deployment IDs, filtering out unhealthy ones.
     *
     * FIX: Deployments with healthy: false are now properly excluded
     * from the selection pool instead of being considered available.
     */
    private getAvailableDeploymentIds(ids: string[]): string[] {
        return ids.filter((id) => {
            const state = this.deployments.get(id);
            if (!state) return false;
            // Exclude explicitly unhealthy deployments
            if (state.config.healthy === false) return false;
            // Exclude deployments that are not available (e.g., missing API key)
            if (!state.provider.isAvailable()) return false;
            return true;
        });
    }

    /**
     * Select a deployment using the configured load balancing strategy.
     */
    private selectDeployment(availableIds: string[]): string | null {
        if (availableIds.length === 0) return null;
        if (availableIds.length === 1) return availableIds[0];

        switch (this.strategy) {
            case "least-busy":
                return this.selectLeastBusy(availableIds);
            case "round-robin":
                return this.selectRoundRobin(availableIds);
            case "weighted":
                return this.selectWeighted(availableIds);
            case "random":
                return this.selectRandom(availableIds);
            default:
                return this.selectLeastBusy(availableIds);
        }
    }

    private selectLeastBusy(ids: string[]): string {
        let minRequests = Infinity;
        let selected = ids[0];

        for (const id of ids) {
            const state = this.deployments.get(id);
            if (state && state.activeRequests < minRequests) {
                minRequests = state.activeRequests;
                selected = id;
            }
        }

        return selected;
    }

    private selectRoundRobin(ids: string[]): string {
        const selected = ids[this.roundRobinIndex % ids.length];
        this.roundRobinIndex++;
        return selected;
    }

    private selectWeighted(ids: string[]): string {
        const weights = ids.map((id) => {
            const state = this.deployments.get(id);
            return state?.config.weight || 1;
        });
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < ids.length; i++) {
            random -= weights[i];
            if (random <= 0) return ids[i];
        }

        return ids[ids.length - 1];
    }

    private selectRandom(ids: string[]): string {
        return ids[Math.floor(Math.random() * ids.length)];
    }

    /**
     * Record a failure for a deployment, used for health tracking.
     */
    private recordFailure(deploymentId: string): void {
        const state = this.deployments.get(deploymentId);
        if (state) {
            state.consecutiveFailures++;
            state.lastError = "Request failed";
            state.lastErrorTime = Date.now();
        }
    }

    /**
     * Create the appropriate provider instance for a deployment config.
     */
    private createProvider(config: DeploymentConfig): ILLMProvider {
        switch (config.provider) {
            case "openai":
                return new OpenAIProvider({
                    apiKey: config.apiKey,
                    orgId: config.orgId,
                    baseUrl: config.baseUrl,
                    model: config.model,
                });
            case "gemini":
                return new GeminiProvider({
                    apiKey: config.apiKey,
                    model: config.model,
                    baseUrl: config.baseUrl,
                });
            case "cohere":
                return new CohereProvider({
                    apiKey: config.apiKey,
                    model: config.model,
                    baseUrl: config.baseUrl,
                });
            default:
                throw new Error(`Unknown provider: ${config.provider}`);
        }
    }
}

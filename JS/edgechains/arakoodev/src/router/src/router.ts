import fs from "fs";
import { emitLog, resolveCallbacks } from "./callbacks.js";
import { Deployment } from "./deployment.js";
import { apiModelName, ProviderChunk } from "./providers.js";
import type {
    CompletionRequest,
    DeploymentConfig,
    DeploymentUsageSnapshot,
    LogEvent,
    LoggingCallback,
    RouterCompletionResponse,
    RouterConfig,
    RouterStreamChunk,
    RoutingStrategy,
    TokenUsage,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_NUM_RETRIES = 2;
const DEFAULT_ALLOWED_FAILS = 0;
const DEFAULT_COOLDOWN_MS = 60_000;

export class NoHealthyDeploymentError extends Error {
    constructor(model: string) {
        super(`No healthy deployment available for model "${model}"`);
        this.name = "NoHealthyDeploymentError";
    }
}

/**
 * litellm-style smart router over a pool of model deployments.
 *
 * - Load balances between deployments of the same model alias, picking the
 *   deployment that is below its rate limits and has used the least tokens
 *   in the current minute ("least-tokens" / "usage-based-routing").
 * - Basic reliability: per-request timeouts and retries live on each
 *   deployment's axios instance (axios-retry interceptors); failed
 *   deployments cool down and traffic fails over to the next deployment.
 * - `completion({ stream: true })` returns an async iterable of chunks.
 * - Token usage is tracked per deployment (`getUsage()` / `getDeployments()`).
 * - `success_callback` / `failure_callback` ship log events to sentry and/or
 *   posthog (or any user supplied callback).
 */
export class Router {
    private readonly deployments: Deployment[] = [];
    private readonly strategy: RoutingStrategy;
    private readonly timeout: number;
    private readonly numRetries: number;
    private readonly fallbacks: Record<string, string[]>;
    private readonly successCallbacks: LoggingCallback[];
    private readonly failureCallbacks: LoggingCallback[];

    constructor(config: RouterConfig | DeploymentConfig[]) {
        const cfg: RouterConfig = Array.isArray(config) ? { model_list: config } : config;
        if (!cfg.model_list?.length) {
            throw new Error("Router requires a non-empty `model_list`");
        }
        const defaults = {
            timeout: cfg.timeout ?? DEFAULT_TIMEOUT_MS,
            numRetries: cfg.num_retries ?? DEFAULT_NUM_RETRIES,
            allowedFails: cfg.allowed_fails ?? DEFAULT_ALLOWED_FAILS,
            cooldownTime: cfg.cooldown_time ?? DEFAULT_COOLDOWN_MS,
        };
        cfg.model_list.forEach((deploymentConfig, i) => {
            this.deployments.push(new Deployment(deploymentConfig, i, defaults));
        });
        this.strategy = cfg.routing_strategy ?? "least-tokens";
        this.timeout = defaults.timeout;
        this.numRetries = defaults.numRetries;
        this.fallbacks = cfg.fallbacks ?? {};
        this.successCallbacks = resolveCallbacks(cfg.success_callback, cfg);
        this.failureCallbacks = resolveCallbacks(cfg.failure_callback, cfg);
    }

    /**
     * Build a router from a jsonnet config file — the preferred way to
     * configure routing in EdgeChains. Pass an `@arakoodev/jsonnet`
     * instance to evaluate full jsonnet; without one, files that are plain
     * JSON (valid jsonnet) are still supported.
     */
    static fromJsonnet(path: string, jsonnet?: { evaluateFile(file: string): string }): Router {
        let evaluated: string;
        if (jsonnet) {
            evaluated = jsonnet.evaluateFile(path);
        } else {
            evaluated = evaluateJsonnetFallback(path);
        }
        return new Router(JSON.parse(evaluated) as RouterConfig);
    }

    /** Deployments backing a model alias, exposed for inspection. */
    getModelList(model?: string): Deployment[] {
        return model
            ? this.deployments.filter((d) => d.modelName === model)
            : [...this.deployments];
    }

    /** Token/request usage per deployment (litellm `token_usage`). */
    getUsage(): DeploymentUsageSnapshot[] {
        return this.deployments.map((d) => d.snapshot());
    }

    /** Aggregate token usage across all deployments. */
    getTotalUsage(): TokenUsage & { requests: number; successes: number; failures: number } {
        return this.getUsage().reduce(
            (acc, s) => ({
                requests: acc.requests + s.requests,
                successes: acc.successes + s.successes,
                failures: acc.failures + s.failures,
                prompt_tokens: acc.prompt_tokens + s.prompt_tokens,
                completion_tokens: acc.completion_tokens + s.completion_tokens,
                total_tokens: acc.total_tokens + s.total_tokens,
            }),
            {
                requests: 0,
                successes: 0,
                failures: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            }
        );
    }

    completion(request: CompletionRequest & { stream: true }): AsyncIterable<RouterStreamChunk>;
    completion(request: CompletionRequest): Promise<RouterCompletionResponse>;
    completion(
        request: CompletionRequest
    ): Promise<RouterCompletionResponse> | AsyncIterable<RouterStreamChunk> {
        if (request.stream) return this.streamCompletion(request);
        return this.complete(request);
    }

    /** Ordered aliases to try: the requested model plus configured fallbacks. */
    private modelChain(model: string): string[] {
        return [model, ...(this.fallbacks[model] ?? [])].filter(
            (name, i, arr) => arr.indexOf(name) === i
        );
    }

    /**
     * Pick the deployment that is below rate limits and scores best for the
     * routing strategy. Default ("least-tokens") chooses the deployment with
     * the least tokens used in the current minute.
     */
    private pickDeployment(modelName: string, exclude: Set<Deployment>): Deployment | undefined {
        const candidates = this.deployments.filter(
            (d) =>
                d.modelName === modelName &&
                !exclude.has(d) &&
                d.isHealthy() &&
                d.isUnderRateLimit()
        );
        if (!candidates.length) return undefined;
        switch (this.strategy) {
            case "least-busy":
                candidates.sort(
                    (a, b) =>
                        a.currentRequests - b.currentRequests || a.currentTokens - b.currentTokens
                );
                break;
            case "simple-shuffle":
                return candidates[Math.floor(Math.random() * candidates.length)];
            case "usage-based-routing":
            case "least-tokens":
            default:
                candidates.sort(
                    (a, b) =>
                        a.currentTokens - b.currentTokens || a.currentRequests - b.currentRequests
                );
                break;
        }
        return candidates[0];
    }

    private async complete(request: CompletionRequest): Promise<RouterCompletionResponse> {
        let lastError: unknown;
        for (const modelName of this.modelChain(request.model)) {
            const tried = new Set<Deployment>();
            let deployment: Deployment | undefined;
            while ((deployment = this.pickDeployment(modelName, tried))) {
                tried.add(deployment);
                deployment.recordRequest();
                const start = Date.now();
                try {
                    const result = await deployment.complete(request);
                    deployment.recordSuccess(result.usage);
                    this.emitSuccess(request, deployment, result.usage, Date.now() - start);
                    return {
                        id: result.id,
                        model: apiModelName(deployment.config.litellm_params.model),
                        provider: deployment.provider.name,
                        deployment: deployment.id,
                        choices: result.choices,
                        usage: result.usage,
                        raw: result.raw,
                    };
                } catch (error) {
                    deployment.recordFailure();
                    this.emitFailure(request, deployment, error, Date.now() - start);
                    lastError = error;
                }
            }
        }
        throw lastError ?? new NoHealthyDeploymentError(request.model);
    }

    private async *streamCompletion(request: CompletionRequest): AsyncGenerator<RouterStreamChunk> {
        let lastError: unknown;
        let established:
            | {
                  deployment: Deployment;
                  iterator: AsyncIterator<ProviderChunk>;
                  first: IteratorResult<ProviderChunk>;
              }
            | undefined;
        for (const modelName of this.modelChain(request.model)) {
            const tried = new Set<Deployment>();
            let deployment: Deployment | undefined;
            while ((deployment = this.pickDeployment(modelName, tried))) {
                tried.add(deployment);
                deployment.recordRequest();
                const start = Date.now();
                try {
                    const iterator = deployment.stream(request)[Symbol.asyncIterator]();
                    const first = await iterator.next();
                    established = { deployment, iterator, first };
                    break;
                } catch (error) {
                    deployment.recordFailure();
                    this.emitFailure(request, deployment, error, Date.now() - start);
                    lastError = error;
                }
            }
            if (established) break;
        }
        if (!established) throw lastError ?? new NoHealthyDeploymentError(request.model);

        const { deployment, iterator, first } = established;
        const start = Date.now();
        let usage: TokenUsage | undefined;
        try {
            let current = first;
            while (!current.done) {
                const chunk = current.value;
                usage = chunk.usage ?? usage;
                yield this.toStreamChunk(chunk, deployment);
                current = await iterator.next();
            }
            deployment.recordSuccess(usage);
            this.emitSuccess(request, deployment, usage, Date.now() - start);
        } catch (error) {
            deployment.recordFailure();
            this.emitFailure(request, deployment, error, Date.now() - start);
            throw error;
        }
    }

    private toStreamChunk(chunk: ProviderChunk, deployment: Deployment): RouterStreamChunk {
        return {
            model: apiModelName(deployment.config.litellm_params.model),
            provider: deployment.provider.name,
            deployment: deployment.id,
            choices: chunk.choices,
            usage: chunk.usage,
            raw: chunk.raw,
        };
    }

    private emitSuccess(
        request: CompletionRequest,
        deployment: Deployment,
        usage: TokenUsage | undefined,
        latencyMs: number
    ): void {
        this.emit(this.successCallbacks, {
            type: "success",
            model: request.model,
            deployment: deployment.id,
            provider: deployment.provider.name,
            usage,
            latency_ms: latencyMs,
            messages: request.messages,
            timestamp: new Date().toISOString(),
            metadata: request.metadata,
        });
    }

    private emitFailure(
        request: CompletionRequest,
        deployment: Deployment,
        error: unknown,
        latencyMs: number
    ): void {
        this.emit(this.failureCallbacks, {
            type: "failure",
            model: request.model,
            deployment: deployment.id,
            provider: deployment.provider.name,
            latency_ms: latencyMs,
            messages: request.messages,
            error: {
                message: error instanceof Error ? error.message : String(error),
                status: (error as { response?: { status?: number } })?.response?.status,
            },
            timestamp: new Date().toISOString(),
            metadata: request.metadata,
        });
    }

    private emit(callbacks: LoggingCallback[], event: LogEvent): void {
        emitLog(callbacks, event);
    }
}

function evaluateJsonnetFallback(path: string): string {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require("@arakoodev/jsonnet");
        const Jsonnet = mod.default ?? mod;
        return new Jsonnet().evaluateFile(path);
    } catch (error) {
        const contents = fs.readFileSync(path, "utf-8");
        try {
            JSON.parse(contents);
        } catch {
            throw new Error(
                `Router.fromJsonnet: "${path}" could not be evaluated. Install @arakoodev/jsonnet or pass a Jsonnet instance to evaluate non-JSON jsonnet. (${(error as Error).message})`
            );
        }
        return contents;
    }
}

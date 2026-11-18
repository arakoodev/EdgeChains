import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

import {
    ChatRequest,
    ChatResponse,
    Deployment,
    FailureContext,
    Provider,
    RouterCallback,
    RouterOptions,
    StreamChunk,
    SuccessContext,
    Usage,
} from "./types.js";
import { openaiChat, openaiStream } from "./providers/openai.js";
import { palmChat, palmStream } from "./providers/palm.js";
import { cohereChat, cohereStream } from "./providers/cohere.js";

interface DeploymentState {
    deployment: Required<Pick<Deployment, "id">> & Deployment;
    /** Minute window key. When Date.now()/60000 floor changes we reset counters. */
    window: number;
    requests_this_minute: number;
    tokens_this_minute: number;
    cumulative_tokens: number;
    /** Window key that this deployment is cooled down for (set when we observe a 429). */
    cooldown_until_window: number | null;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_FALLBACK_ATTEMPTS = 4;

/**
 * SmartRouter — load-balances chat requests across multiple OpenAI / PaLM /
 * Cohere deployments. Routing picks the deployment that is below its
 * configured rpm / tpm and has the fewest cumulative tokens used so far. On
 * a 429 the deployment is cooled until the next minute window and traffic
 * fails over to the next eligible deployment.
 */
export class SmartRouter {
    private readonly states: DeploymentState[] = [];
    private readonly callbacks: RouterCallback[] = [];
    private readonly http: AxiosInstance;
    private readonly options: Required<RouterOptions>;

    constructor(options: RouterOptions = {}) {
        this.options = {
            timeout_ms: options.timeout_ms ?? DEFAULT_TIMEOUT_MS,
            retries: options.retries ?? DEFAULT_RETRIES,
            fallback_attempts: options.fallback_attempts ?? DEFAULT_FALLBACK_ATTEMPTS,
        };

        this.http = axios.create({ timeout: this.options.timeout_ms });
        axiosRetry(this.http, {
            retries: this.options.retries,
            retryDelay: axiosRetry.exponentialDelay,
            // Retry network errors and 5xx in place. We deliberately do NOT
            // retry 429 here; those flip the deployment to cooldown and route
            // away instead, which matches what LiteLLM's router does.
            retryCondition: (err) => {
                if (axiosRetry.isNetworkOrIdempotentRequestError(err)) return true;
                const status = err.response?.status;
                return typeof status === "number" && status >= 500 && status < 600;
            },
        });
    }

    register(deployment: Deployment): string {
        const id = deployment.id ?? `${deployment.provider}:${deployment.model}:${this.states.length}`;
        const filled: DeploymentState["deployment"] = {
            ...deployment,
            id,
            timeout_ms: deployment.timeout_ms ?? this.options.timeout_ms,
        };
        this.states.push({
            deployment: filled,
            window: currentWindow(),
            requests_this_minute: 0,
            tokens_this_minute: 0,
            cumulative_tokens: 0,
            cooldown_until_window: null,
        });
        return id;
    }

    addCallback(cb: RouterCallback): void {
        this.callbacks.push(cb);
    }

    /** Per-deployment cumulative usage. */
    getUsage(deploymentId: string): { cumulative_tokens: number; tokens_this_minute: number; requests_this_minute: number } | null {
        const s = this.states.find((x) => x.deployment.id === deploymentId);
        if (!s) return null;
        this.rolloverIfStale(s);
        return {
            cumulative_tokens: s.cumulative_tokens,
            tokens_this_minute: s.tokens_this_minute,
            requests_this_minute: s.requests_this_minute,
        };
    }

    /**
     * Pick the next eligible deployment. Visible for testing — production
     * callers should use `chat`.
     */
    pickDeployment(req: ChatRequest = {}): DeploymentState | null {
        const now = currentWindow();
        const eligible = this.states.filter((s) => {
            this.rolloverIfStale(s);
            if (req.model && s.deployment.model !== req.model) return false;
            if (s.cooldown_until_window !== null && s.cooldown_until_window >= now) return false;
            const rpm = s.deployment.rpm_limit;
            const tpm = s.deployment.tpm_limit;
            if (typeof rpm === "number" && s.requests_this_minute >= rpm) return false;
            if (typeof tpm === "number" && s.tokens_this_minute >= tpm) return false;
            return true;
        });
        if (eligible.length === 0) return null;
        // Least cumulative tokens wins; ties broken by the order deployments
        // were registered (stable sort).
        eligible.sort((a, b) => a.cumulative_tokens - b.cumulative_tokens);
        return eligible[0];
    }

    async chat(req: ChatRequest): Promise<ChatResponse> {
        if (req.stream) {
            throw new Error("chat() called with stream:true; use stream() instead");
        }

        const tried = new Set<string>();
        const maxAttempts = Math.max(1, this.options.fallback_attempts);
        let lastErr: Error | null = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const candidate = this.pickDeploymentExcluding(req, tried);
            if (!candidate) break;
            tried.add(candidate.deployment.id);

            const start = Date.now();
            try {
                const adapter = chatAdapterFor(candidate.deployment.provider);
                const response = await adapter(this.http, candidate.deployment, req);
                this.recordSuccess(candidate, response.usage);
                await this.fireSuccess({
                    deployment_id: candidate.deployment.id,
                    provider: candidate.deployment.provider,
                    model: candidate.deployment.model,
                    request: req,
                    duration_ms: Date.now() - start,
                    response,
                });
                return response;
            } catch (err) {
                const e = err instanceof Error ? err : new Error(String(err));
                lastErr = e;
                this.handleError(candidate, e);
                await this.fireFailure({
                    deployment_id: candidate.deployment.id,
                    provider: candidate.deployment.provider,
                    model: candidate.deployment.model,
                    request: req,
                    duration_ms: Date.now() - start,
                    error: e,
                });
                // Loop continues; a different deployment will be picked.
            }
        }

        throw lastErr ?? new Error("SmartRouter: no eligible deployment available");
    }

    async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
        const tried = new Set<string>();
        const maxAttempts = Math.max(1, this.options.fallback_attempts);
        let lastErr: Error | null = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const candidate = this.pickDeploymentExcluding(req, tried);
            if (!candidate) break;
            tried.add(candidate.deployment.id);

            const start = Date.now();
            const adapter = streamAdapterFor(candidate.deployment.provider);
            const iter = adapter(this.http, candidate.deployment, { ...req, stream: true });

            try {
                let collected = "";
                let finalUsage: Usage | undefined;
                for await (const chunk of iter) {
                    if (chunk.delta) collected += chunk.delta;
                    if (chunk.done && chunk.usage) finalUsage = chunk.usage;
                    yield chunk;
                }
                const usage = finalUsage ?? {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                };
                this.recordSuccess(candidate, usage);
                await this.fireSuccess({
                    deployment_id: candidate.deployment.id,
                    provider: candidate.deployment.provider,
                    model: candidate.deployment.model,
                    request: req,
                    duration_ms: Date.now() - start,
                    response: {
                        content: collected,
                        usage,
                        deployment_id: candidate.deployment.id,
                        provider: candidate.deployment.provider,
                        model: candidate.deployment.model,
                    },
                });
                return;
            } catch (err) {
                const e = err instanceof Error ? err : new Error(String(err));
                lastErr = e;
                this.handleError(candidate, e);
                await this.fireFailure({
                    deployment_id: candidate.deployment.id,
                    provider: candidate.deployment.provider,
                    model: candidate.deployment.model,
                    request: req,
                    duration_ms: Date.now() - start,
                    error: e,
                });
            }
        }

        throw lastErr ?? new Error("SmartRouter: no eligible deployment available");
    }

    // ---- internals ----

    private pickDeploymentExcluding(req: ChatRequest, tried: Set<string>): DeploymentState | null {
        // Build the same eligibility set but skip already-tried ids.
        const now = currentWindow();
        const eligible = this.states.filter((s) => {
            this.rolloverIfStale(s);
            if (tried.has(s.deployment.id)) return false;
            if (req.model && s.deployment.model !== req.model) return false;
            if (s.cooldown_until_window !== null && s.cooldown_until_window >= now) return false;
            const rpm = s.deployment.rpm_limit;
            const tpm = s.deployment.tpm_limit;
            if (typeof rpm === "number" && s.requests_this_minute >= rpm) return false;
            if (typeof tpm === "number" && s.tokens_this_minute >= tpm) return false;
            return true;
        });
        if (eligible.length === 0) return null;
        eligible.sort((a, b) => a.cumulative_tokens - b.cumulative_tokens);
        return eligible[0];
    }

    private rolloverIfStale(s: DeploymentState) {
        const w = currentWindow();
        if (w !== s.window) {
            s.window = w;
            s.requests_this_minute = 0;
            s.tokens_this_minute = 0;
            // Cooldown only lasts within the window where the 429 was observed.
            if (s.cooldown_until_window !== null && s.cooldown_until_window < w) {
                s.cooldown_until_window = null;
            }
        }
    }

    private recordSuccess(s: DeploymentState, usage: Usage) {
        this.rolloverIfStale(s);
        s.requests_this_minute += 1;
        s.tokens_this_minute += usage.total_tokens;
        s.cumulative_tokens += usage.total_tokens;
    }

    private handleError(s: DeploymentState, err: Error) {
        this.rolloverIfStale(s);
        s.requests_this_minute += 1;
        const status = (err as any)?.response?.status;
        if (status === 429) {
            // Cool this deployment down for the rest of the current minute.
            s.cooldown_until_window = s.window;
        }
    }

    private async fireSuccess(ctx: SuccessContext) {
        for (const cb of this.callbacks) {
            if (cb.on_success) {
                try {
                    await cb.on_success(ctx);
                } catch {
                    // Callbacks must not break routing.
                }
            }
        }
    }

    private async fireFailure(ctx: FailureContext) {
        for (const cb of this.callbacks) {
            if (cb.on_failure) {
                try {
                    await cb.on_failure(ctx);
                } catch {
                    // Callbacks must not break routing.
                }
            }
        }
    }
}

function currentWindow(): number {
    return Math.floor(Date.now() / 60_000);
}

function chatAdapterFor(provider: Provider) {
    switch (provider) {
        case "openai":
            return openaiChat;
        case "google_palm":
            return palmChat;
        case "cohere":
            return cohereChat;
    }
}

function streamAdapterFor(provider: Provider) {
    switch (provider) {
        case "openai":
            return openaiStream;
        case "google_palm":
            return palmStream;
        case "cohere":
            return cohereStream;
    }
}

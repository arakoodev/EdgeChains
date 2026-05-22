import axios from "axios";

import { cohereCompletion, cohereStream } from "./providers/cohere.js";
import { googleCompletion, googleStream } from "./providers/google.js";
import { openaiCompletion, openaiStream } from "./providers/openai.js";
import type {
    CompletionRequest,
    CompletionResponse,
    DeploymentSnapshot,
    FailureContext,
    FallbackContext,
    NormalizedDeployment,
    Provider,
    ProviderCompletion,
    ProviderStream,
    RouteContext,
    RouterCallback,
    RouterDeployment,
    RouterHttpClient,
    RouterLogger,
    RouterModelGroup,
    RouterOptions,
    RoutingStrategy,
    StreamChunk,
    SuccessContext,
    Usage,
} from "./types.js";

interface DeploymentState {
    deployment: NormalizedDeployment;
    window: number;
    requests_this_minute: number;
    tokens_this_minute: number;
    cumulative_tokens: number;
    successes: number;
    failures: number;
    cooldown_until: number;
    latency_ms: number;
}

interface NormalizedGroup {
    name: string;
    strategy: RoutingStrategy;
    fallbacks: string[];
    priority: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_COOLDOWN_MS = 60_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_FALLBACK_ATTEMPTS = 8;
const DEFAULT_BACKOFF_BASE_MS = 200;
const DEFAULT_BACKOFF_MAX_MS = 4_000;
const DEFAULT_LATENCY_MS = 1_000;

const noopLogger: RouterLogger = {};

/**
 * LiteLLM-style router for EdgeChains AI calls.
 *
 * It accepts model groups / deployments, exposes a single `completion()` API,
 * tracks RPM/TPM/token usage, cools deployments on 429, retries transient
 * provider failures with backoff, and falls back across ordered groups.
 */
export class SmartRouter {
    private readonly states: DeploymentState[] = [];
    private readonly groups = new Map<string, NormalizedGroup>();
    private readonly callbacks: RouterCallback[] = [];
    private readonly http: RouterHttpClient;
    private readonly logger: RouterLogger;
    private readonly strategy: RoutingStrategy;
    private readonly timeoutMs: number;
    private readonly retries: number;
    private readonly fallbackAttempts: number;
    private readonly cooldownMs: number;
    private readonly backoffBaseMs: number;
    private readonly backoffMaxMs: number;
    private readonly random: () => number;
    private readonly now: () => number;
    private readonly sleep: (ms: number) => Promise<void>;
    private roundRobinCursor = 0;

    constructor(options: RouterOptions = {}) {
        this.strategy = options.strategy ?? "least-tokens";
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.retries = options.retries ?? DEFAULT_RETRIES;
        this.fallbackAttempts = options.fallbackAttempts ?? DEFAULT_FALLBACK_ATTEMPTS;
        this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
        this.backoffBaseMs = options.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS;
        this.backoffMaxMs = options.backoffMaxMs ?? DEFAULT_BACKOFF_MAX_MS;
        this.logger = options.logger ?? noopLogger;
        this.random = options.random ?? Math.random;
        this.now = options.now ?? Date.now;
        this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
        this.http = options.httpClient ?? axios.create({ timeout: this.timeoutMs });

        for (const callback of options.callbacks ?? []) this.addCallback(callback);
        this.registerGroups(options.modelGroups ?? options.modelGroupsFromJsonnet ?? []);
        this.registerDeployments(options.deployments ?? options.model_list ?? []);
    }

    /** Build a router from jsonnet output parsed into plain JavaScript. */
    static fromConfig(config: RouterOptions): SmartRouter {
        return new SmartRouter(config);
    }

    registerGroups(groups: RouterModelGroup[]): void {
        for (const group of groups) {
            this.groups.set(group.name, {
                name: group.name,
                strategy: group.strategy ?? this.strategy,
                fallbacks: group.fallbacks ?? [],
                priority: group.priority ?? 100,
            });
            this.registerDeployments(group.deployments.map((deployment) => ({ ...deployment, group: deployment.group ?? group.name })));
        }
    }

    registerDeployments(deployments: RouterDeployment[]): void {
        for (const deployment of deployments) this.register(deployment);
    }

    register(deployment: RouterDeployment): string {
        const normalized = this.normalizeDeployment(deployment);
        this.states.push({
            deployment: normalized,
            window: this.currentWindow(),
            requests_this_minute: 0,
            tokens_this_minute: 0,
            cumulative_tokens: 0,
            successes: 0,
            failures: 0,
            cooldown_until: 0,
            latency_ms: normalized.latencyMs,
        });

        if (!this.groups.has(normalized.group)) {
            this.groups.set(normalized.group, {
                name: normalized.group,
                strategy: this.strategy,
                fallbacks: [],
                priority: normalized.priority,
            });
        }

        return normalized.id;
    }

    addCallback(callback: RouterCallback): void {
        this.callbacks.push(callback);
    }

    /** OpenAI-compatible completion interface. */
    async completion(request: CompletionRequest): Promise<CompletionResponse> {
        if (request.stream) throw new Error("completion() does not return streams; use stream() instead");

        let lastError: Error | null = null;
        let attempts = 0;

        for (const groupName of this.groupOrder(request.model)) {
            const triedInGroup = new Set<string>();

            while (attempts < this.fallbackAttempts) {
                const state = this.pickDeployment(groupName, request, triedInGroup);
                if (!state) break;

                triedInGroup.add(state.deployment.id);
                attempts += 1;

                const result = await this.runDeployment(state, groupName, attempts, request);
                if (result.ok) return result.response;

                lastError = result.error;
                if (!this.shouldRouteAway(result.error)) throw result.error;
            }
        }

        throw lastError ?? new Error("SmartRouter: no eligible deployment available");
    }

    /** Alias retained for existing `chat`-style usage. */
    async chat(request: CompletionRequest): Promise<CompletionResponse> {
        return this.completion(request);
    }

    async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
        let lastError: Error | null = null;
        let attempts = 0;

        for (const groupName of this.groupOrder(request.model)) {
            const triedInGroup = new Set<string>();

            while (attempts < this.fallbackAttempts) {
                const state = this.pickDeployment(groupName, request, triedInGroup);
                if (!state) break;

                triedInGroup.add(state.deployment.id);
                attempts += 1;

                const start = this.now();
                const context = this.context(state, groupName, attempts, request);
                await this.fireStart(context);
                this.logger.info?.("SmartRouter stream start", this.safeLog({ ...context }));

                let yielded = false;
                let content = "";
                let finalUsage: Usage | undefined;

                try {
                    const adapter = this.streamAdapterFor(state.deployment.provider);
                    for await (const chunk of adapter(this.http, state.deployment, { ...request, stream: true })) {
                        yielded = true;
                        if (chunk.delta) content += chunk.delta;
                        if (chunk.done && chunk.usage && chunk.usage.total_tokens > 0) finalUsage = chunk.usage;
                        yield chunk;
                    }

                    const usage = finalUsage ?? this.estimateUsage(request, content);
                    this.recordSuccess(state, usage, this.now() - start);
                    await this.fireSuccess({
                        ...context,
                        duration_ms: this.now() - start,
                        response: {
                            content,
                            usage,
                            provider: state.deployment.provider,
                            model: state.deployment.model,
                            deployment_id: state.deployment.id,
                        },
                    });
                    return;
                } catch (err) {
                    const error = toError(err);
                    lastError = error;
                    const status = statusFromError(error);
                    this.recordFailure(state, error);
                    const failure = { ...context, duration_ms: this.now() - start, error, status };
                    await this.fireFailure(failure);
                    await this.fireFallback({
                        ...failure,
                        cooldown_until: state.cooldown_until || undefined,
                        next_group: this.nextGroupAfter(groupName, request.model),
                    });

                    // If some stream bytes already reached the caller, do not
                    // silently replay the prompt on another provider; duplicated
                    // partial output is worse than surfacing the stream error.
                    if (yielded || !this.shouldRouteAway(error)) throw error;
                }
            }
        }

        throw lastError ?? new Error("SmartRouter: no eligible deployment available");
    }

    getDeploymentState(deploymentId: string): DeploymentSnapshot | null {
        const state = this.states.find((candidate) => candidate.deployment.id === deploymentId);
        if (!state) return null;
        this.rolloverIfStale(state);
        return {
            id: state.deployment.id,
            group: state.deployment.group,
            provider: state.deployment.provider,
            model: state.deployment.model,
            priority: state.deployment.priority,
            weight: state.deployment.weight,
            requests_this_minute: state.requests_this_minute,
            tokens_this_minute: state.tokens_this_minute,
            cumulative_tokens: state.cumulative_tokens,
            successes: state.successes,
            failures: state.failures,
            cooldown_until: state.cooldown_until,
            latency_ms: Math.round(state.latency_ms),
        };
    }

    getUsage(deploymentId: string): Pick<DeploymentSnapshot, "requests_this_minute" | "tokens_this_minute" | "cumulative_tokens"> | null {
        const snapshot = this.getDeploymentState(deploymentId);
        if (!snapshot) return null;
        return {
            requests_this_minute: snapshot.requests_this_minute,
            tokens_this_minute: snapshot.tokens_this_minute,
            cumulative_tokens: snapshot.cumulative_tokens,
        };
    }

    listDeployments(): DeploymentSnapshot[] {
        return this.states
            .map((state) => this.getDeploymentState(state.deployment.id))
            .filter((snapshot): snapshot is DeploymentSnapshot => snapshot !== null);
    }

    private async runDeployment(
        state: DeploymentState,
        groupName: string,
        attempt: number,
        request: CompletionRequest
    ): Promise<{ ok: true; response: CompletionResponse } | { ok: false; error: Error }> {
        const context = this.context(state, groupName, attempt, request);
        const adapter = this.completionAdapterFor(state.deployment.provider);

        for (let retryAttempt = 0; retryAttempt <= this.retries; retryAttempt++) {
            const start = this.now();
            await this.fireStart(context);
            this.logger.info?.("SmartRouter completion start", this.safeLog({ ...context, retryAttempt }));

            try {
                const response = await adapter(this.http, state.deployment, request);
                this.recordSuccess(state, response.usage, this.now() - start);
                await this.fireSuccess({ ...context, duration_ms: this.now() - start, response });
                this.logger.info?.("SmartRouter completion success", this.safeLog({
                    ...context,
                    duration_ms: this.now() - start,
                    total_tokens: response.usage.total_tokens,
                }));
                return { ok: true, response };
            } catch (err) {
                const error = toError(err);
                const status = statusFromError(error);
                this.recordFailure(state, error);
                const failure: FailureContext = { ...context, duration_ms: this.now() - start, error, status };
                await this.fireFailure(failure);
                this.logger.warn?.("SmartRouter completion failure", this.safeLog({ ...failure, message: error.message }));

                if (this.isRateLimit(error)) {
                    await this.fireFallback({
                        ...failure,
                        cooldown_until: state.cooldown_until,
                        next_group: this.nextGroupAfter(groupName, request.model),
                    });
                    return { ok: false, error };
                }

                if (!this.isRetryableInPlace(error) || retryAttempt >= this.retries) {
                    await this.fireFallback({
                        ...failure,
                        cooldown_until: state.cooldown_until || undefined,
                        next_group: this.nextGroupAfter(groupName, request.model),
                    });
                    return { ok: false, error };
                }

                await this.sleep(this.backoffDelay(retryAttempt));
            }
        }

        return { ok: false, error: new Error("SmartRouter: retry loop exhausted") };
    }

    private normalizeDeployment(deployment: RouterDeployment): NormalizedDeployment {
        const apiKey = deployment.apiKey ?? deployment.api_key ?? readEnv(deployment.apiKeyEnv) ?? "";
        const group = deployment.group ?? deployment.model;
        const id = deployment.id ?? `${group}:${deployment.provider}:${deployment.model}:${this.states.length}`;
        const rpmLimit = deployment.rpmLimit ?? deployment.rpm_limit;
        const tpmLimit = deployment.tpmLimit ?? deployment.tpm_limit;

        return {
            ...deployment,
            id,
            group,
            apiKey,
            api_key: apiKey,
            priority: deployment.priority ?? 100,
            weight: deployment.weight ?? 1,
            rpmLimit,
            rpm_limit: rpmLimit,
            tpmLimit,
            tpm_limit: tpmLimit,
            cooldownMs: deployment.cooldownMs ?? this.cooldownMs,
            timeoutMs: deployment.timeoutMs ?? this.timeoutMs,
            latencyMs: deployment.latencyMs ?? DEFAULT_LATENCY_MS,
        };
    }

    private groupOrder(model?: string): string[] {
        const allGroups = [...this.groups.values()].sort((a, b) => a.priority - b.priority);
        if (!model) return allGroups.map((group) => group.name);

        const directGroup = this.groups.get(model);
        if (directGroup) return this.expandFallbacks(directGroup.name);

        const modelGroups = allGroups
            .filter((group) => this.states.some((state) => state.deployment.group === group.name && state.deployment.model === model))
            .map((group) => group.name);

        return modelGroups.length > 0 ? modelGroups : [model];
    }

    private expandFallbacks(groupName: string, seen = new Set<string>()): string[] {
        if (seen.has(groupName)) return [];
        seen.add(groupName);
        const group = this.groups.get(groupName);
        if (!group) return [groupName];
        return [groupName, ...group.fallbacks.flatMap((fallback) => this.expandFallbacks(fallback, seen))];
    }

    private nextGroupAfter(groupName: string, model?: string): string | undefined {
        const order = this.groupOrder(model);
        const index = order.indexOf(groupName);
        return index >= 0 ? order[index + 1] : undefined;
    }

    private pickDeployment(groupName: string, request: CompletionRequest, tried: Set<string>): DeploymentState | null {
        const group = this.groups.get(groupName);
        const strategy = group?.strategy ?? this.strategy;
        const estimatedTokens = this.estimatePromptTokens(request) + (request.max_tokens ?? request.maxTokens ?? 0);
        const candidates = this.states.filter((state) => {
            this.rolloverIfStale(state);
            if (tried.has(state.deployment.id)) return false;
            if (state.deployment.group !== groupName && state.deployment.model !== groupName) return false;
            if (request.model && !this.groups.has(request.model) && state.deployment.model !== request.model) return false;
            if (state.cooldown_until > this.now()) return false;
            if (state.deployment.rpmLimit && state.requests_this_minute >= state.deployment.rpmLimit) return false;
            if (state.deployment.tpmLimit && state.tokens_this_minute + estimatedTokens > state.deployment.tpmLimit) return false;
            return true;
        });

        if (candidates.length === 0) return null;
        candidates.sort((a, b) => a.deployment.priority - b.deployment.priority);
        const bestPriority = candidates[0].deployment.priority;
        const samePriority = candidates.filter((state) => state.deployment.priority === bestPriority);

        if (strategy === "weighted") return this.weightedPick(samePriority);
        if (strategy === "latency") return samePriority.sort((a, b) => a.latency_ms - b.latency_ms)[0];
        if (strategy === "cost") return samePriority.sort((a, b) => this.estimatedCost(a, request) - this.estimatedCost(b, request))[0];
        if (strategy === "priority") return samePriority[0];

        return samePriority.sort((a, b) => {
            const minuteDiff = a.tokens_this_minute - b.tokens_this_minute;
            if (minuteDiff !== 0) return minuteDiff;
            return a.cumulative_tokens - b.cumulative_tokens;
        })[0];
    }

    private weightedPick(candidates: DeploymentState[]): DeploymentState {
        const total = candidates.reduce((sum, state) => sum + Math.max(0, state.deployment.weight), 0);
        if (total <= 0) return candidates[0];
        let cursor = this.random() * total;
        for (const state of candidates) {
            cursor -= Math.max(0, state.deployment.weight);
            if (cursor <= 0) return state;
        }
        this.roundRobinCursor = (this.roundRobinCursor + 1) % candidates.length;
        return candidates[this.roundRobinCursor];
    }

    private estimatedCost(state: DeploymentState, request: CompletionRequest): number {
        const input = this.estimatePromptTokens(request);
        const output = request.max_tokens ?? request.maxTokens ?? 256;
        return input * (state.deployment.cost?.input ?? 0) + output * (state.deployment.cost?.output ?? 0);
    }

    private recordSuccess(state: DeploymentState, usage: Usage, durationMs: number): void {
        this.rolloverIfStale(state);
        const totalTokens = Math.max(usage.total_tokens, 0);
        state.requests_this_minute += 1;
        state.tokens_this_minute += totalTokens;
        state.cumulative_tokens += totalTokens;
        state.successes += 1;
        state.latency_ms = state.latency_ms * 0.8 + durationMs * 0.2;
    }

    private recordFailure(state: DeploymentState, error: Error): void {
        this.rolloverIfStale(state);
        state.requests_this_minute += 1;
        state.failures += 1;
        if (this.isRateLimit(error)) {
            state.cooldown_until = this.now() + this.cooldownFor(error, state.deployment);
        }
    }

    private rolloverIfStale(state: DeploymentState): void {
        const window = this.currentWindow();
        if (state.window === window) return;
        state.window = window;
        state.requests_this_minute = 0;
        state.tokens_this_minute = 0;
    }

    private currentWindow(): number {
        return Math.floor(this.now() / 60_000);
    }

    private context(
        state: DeploymentState,
        group: string,
        attempt: number,
        request: CompletionRequest
    ): RouteContext {
        return {
            request,
            provider: state.deployment.provider,
            model: state.deployment.model,
            deployment_id: state.deployment.id,
            group,
            attempt,
        };
    }

    private completionAdapterFor(provider: Provider): ProviderCompletion {
        switch (provider) {
            case "openai":
                return openaiCompletion;
            case "cohere":
                return cohereCompletion;
            case "google_palm":
            case "gemini":
            case "google":
                return googleCompletion;
        }
    }

    private streamAdapterFor(provider: Provider): ProviderStream {
        switch (provider) {
            case "openai":
                return openaiStream;
            case "cohere":
                return cohereStream;
            case "google_palm":
            case "gemini":
            case "google":
                return googleStream;
        }
    }

    private shouldRouteAway(error: Error): boolean {
        return this.isRateLimit(error) || this.isRetryableInPlace(error);
    }

    private isRateLimit(error: Error): boolean {
        return statusFromError(error) === 429;
    }

    private isRetryableInPlace(error: Error): boolean {
        const status = statusFromError(error);
        return status === undefined || status === 408 || status === 409 || status >= 500;
    }

    private cooldownFor(error: Error, deployment: NormalizedDeployment): number {
        const retryAfter = retryAfterMs(error);
        return retryAfter ?? deployment.cooldownMs;
    }

    private backoffDelay(attempt: number): number {
        const exponential = Math.min(this.backoffMaxMs, this.backoffBaseMs * 2 ** attempt);
        const jitter = Math.floor(this.random() * exponential * 0.25);
        return exponential + jitter;
    }

    private estimatePromptTokens(request: CompletionRequest): number {
        if (request.estimated_prompt_tokens) return request.estimated_prompt_tokens;
        const text = request.prompt ?? request.messages?.map((message) => message.content).join("\n") ?? "";
        return Math.max(1, Math.ceil(text.length / 4));
    }

    private estimateUsage(request: CompletionRequest, content: string): Usage {
        const prompt_tokens = this.estimatePromptTokens(request);
        const completion_tokens = Math.max(1, Math.ceil(content.length / 4));
        return { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens };
    }

    private safeLog(details: Record<string, unknown>): Record<string, unknown> {
        const { request, error, ...rest } = details as Record<string, unknown> & { request?: CompletionRequest; error?: Error };
        return {
            ...rest,
            prompt_present: Boolean(request?.prompt),
            message_count: request?.messages?.length ?? 0,
            error_message: error?.message,
        };
    }

    private async fireStart(ctx: RouteContext): Promise<void> {
        await this.fire("on_start", ctx);
    }

    private async fireSuccess(ctx: SuccessContext): Promise<void> {
        await this.fire("on_success", ctx);
    }

    private async fireFailure(ctx: FailureContext): Promise<void> {
        await this.fire("on_failure", ctx);
    }

    private async fireFallback(ctx: FallbackContext): Promise<void> {
        await this.fire("on_fallback", ctx);
    }

    private async fire(name: keyof RouterCallback, ctx: RouteContext | SuccessContext | FailureContext | FallbackContext): Promise<void> {
        for (const callback of this.callbacks) {
            const fn = callback[name] as ((context: any) => void | Promise<void>) | undefined;
            if (!fn) continue;
            try {
                await fn(ctx);
            } catch (err) {
                this.logger.warn?.("SmartRouter callback failed", { callback: name, error: toError(err).message });
            }
        }
    }
}

function readEnv(name?: string): string | undefined {
    if (!name) return undefined;
    const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    return env?.[name];
}

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

export function statusFromError(error: Error): number | undefined {
    return (error as any)?.response?.status ?? (error as any)?.status;
}

function retryAfterMs(error: Error): number | undefined {
    const headers = (error as any)?.response?.headers ?? {};
    const raw = headers["retry-after"] ?? headers["Retry-After"];
    if (!raw) return undefined;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(String(value));
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
    return undefined;
}

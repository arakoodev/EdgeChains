// Litellm-style smart Router for Edgechain.js.
//
// Features:
//  1. Load balancing across multiple deployments (openai, palm, cohere). The
//     "usage-based" strategy picks the deployment that is below its rate limit
//     and has used the fewest tokens this minute. Failed / rate-limited
//     deployments are benched (cooldown) and routing fails over to the next.
//  2. Streaming completions (`router.stream`).
//  3. Token usage accounting (`router.getUsage` / per-result `usage`).
//  4. Logging callbacks (see ./callbacks for sentry + posthog adapters).
//
// Configuration is a plain object, which makes it natural to drive from a
// jsonnet file (see examples/react-chain/jsonnet/router.jsonnet).

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
    CompletionRequest,
    CompletionResult,
    Deployment,
    DeploymentUsage,
    EmbeddingRequest,
    EmbeddingResult,
    HttpClient,
    RouterCallback,
    RouterEvent,
    RouterOptions,
    RouterRole,
    RoutingStrategy,
    TokenUsage,
} from "./types.js";
import { AxiosHttpClient } from "./httpClient.js";
import { estimateTokens, getAdapter, NormalizedResponse } from "./providers.js";

const WINDOW_MS = 60000;

export class NoMatchingDeploymentError extends Error {
    constructor(model?: string) {
        super(
            model
                ? `no deployment is configured for model "${model}"`
                : "router has no deployments"
        );
        this.name = "NoMatchingDeploymentError";
    }
}

export class NoDeploymentsAvailableError extends Error {
    constructor(model?: string) {
        super(
            `all deployments${
                model ? ` for model "${model}"` : ""
            } are rate-limited or in cooldown`
        );
        this.name = "NoDeploymentsAvailableError";
    }
}

interface DeploymentState {
    windowStart: number;
    requestsInWindow: number;
    tokensInWindow: number;
    cooldownUntil: number;
    totalRequests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export class Router {
    readonly deployments: Deployment[];
    private states: DeploymentState[];
    private strategy: RoutingStrategy;
    private numRetries: number;
    private retryDelay: number;
    private cooldownMs: number;
    private timeout: number;
    private callbacks: RouterCallback[];
    private http: HttpClient;
    private now: () => number;
    private rrCounter = 0;

    constructor(options: RouterOptions) {
        if (!options || !Array.isArray(options.deployments) || options.deployments.length === 0) {
            throw new NoMatchingDeploymentError();
        }
        options.deployments.forEach((d, i) => this.validateDeployment(d, i));

        this.deployments = options.deployments;
        this.strategy = options.strategy ?? "usage-based";
        this.numRetries = options.numRetries ?? 2;
        this.retryDelay = options.retryDelay ?? 200;
        this.cooldownMs = (options.cooldownSeconds ?? 60) * 1000;
        this.timeout = options.timeout ?? 600000;
        this.callbacks = options.callbacks ?? [];
        this.now = options.now ?? Date.now;
        this.http =
            options.httpClient ??
            new AxiosHttpClient({
                numRetries: this.numRetries,
                retryDelay: this.retryDelay,
                timeout: this.timeout,
            });

        const start = this.now();
        this.states = this.deployments.map(() => ({
            windowStart: start,
            requestsInWindow: 0,
            tokensInWindow: 0,
            cooldownUntil: 0,
            totalRequests: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
        }));
    }

    private validateDeployment(d: Deployment, index: number): void {
        if (!d || typeof d.model !== "string" || !d.model) {
            throw new Error(`deployment[${index}] is missing a "model"`);
        }
        if (typeof d.apiKey !== "string" || !d.apiKey) {
            throw new Error(`deployment[${index}] (${d.model}) is missing an "apiKey"`);
        }
        // Throws for unknown providers.
        getAdapter(d.provider);
    }

    /** Token estimate (litellm token_counter parity). */
    static tokenCount(text: string): number {
        return estimateTokens(text);
    }

    /** Estimate the prompt token cost of a request without sending it. */
    tokenCount(req: CompletionRequest): number {
        return estimateTokens(this.promptText(req));
    }

    private promptText(req: CompletionRequest): string {
        if (req.prompt != null) return req.prompt;
        if (req.messages) return req.messages.map((m) => m.content).join("\n");
        return "";
    }

    private rollWindow(state: DeploymentState, now: number): void {
        if (now - state.windowStart >= WINDOW_MS) {
            state.windowStart = now;
            state.requestsInWindow = 0;
            state.tokensInWindow = 0;
        }
    }

    private isEligible(index: number, now: number): boolean {
        const state = this.states[index];
        const dep = this.deployments[index];
        if (now < state.cooldownUntil) return false;
        this.rollWindow(state, now);
        if (dep.rpm != null && state.requestsInWindow >= dep.rpm) return false;
        if (dep.tpm != null && state.tokensInWindow >= dep.tpm) return false;
        return true;
    }

    /** Indices of deployments serving the requested model group. */
    private matching(model?: string): number[] {
        const indices: number[] = [];
        this.deployments.forEach((d, i) => {
            if (!model || d.model === model) indices.push(i);
        });
        return indices;
    }

    /**
     * Pick the best eligible deployment for the model, or null if every
     * matching deployment is currently benched. Throws if none match at all.
     */
    private pick(model?: string): number | null {
        const matching = this.matching(model);
        if (matching.length === 0) throw new NoMatchingDeploymentError(model);
        const now = this.now();
        const eligible = matching.filter((i) => this.isEligible(i, now));
        if (eligible.length === 0) return null;

        if (this.strategy === "round-robin") {
            const choice = eligible[this.rrCounter % eligible.length];
            this.rrCounter += 1;
            return choice;
        }
        // usage-based: fewest tokens used this minute, then fewest requests.
        return eligible.reduce((best, i) => {
            const a = this.states[i];
            const b = this.states[best];
            if (a.tokensInWindow !== b.tokensInWindow)
                return a.tokensInWindow < b.tokensInWindow ? i : best;
            return a.requestsInWindow < b.requestsInWindow ? i : best;
        }, eligible[0]);
    }

    private backfillUsage(normalized: NormalizedResponse, req: CompletionRequest): TokenUsage {
        if (normalized.usage.totalTokens > 0) return normalized.usage;
        const promptTokens = estimateTokens(this.promptText(req));
        const completionTokens = estimateTokens(normalized.content);
        return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
    }

    private recordSuccess(index: number, usage: TokenUsage): void {
        const state = this.states[index];
        this.rollWindow(state, this.now());
        state.requestsInWindow += 1;
        state.tokensInWindow += usage.totalTokens;
        state.totalRequests += 1;
        state.promptTokens += usage.promptTokens;
        state.completionTokens += usage.completionTokens;
        state.totalTokens += usage.totalTokens;
    }

    private recordFailure(index: number): void {
        this.states[index].cooldownUntil = this.now() + this.cooldownMs;
    }

    private async notify(
        kind: "onSuccess" | "onError",
        event: RouterEvent
    ): Promise<void> {
        for (const cb of this.callbacks) {
            const handler = cb[kind];
            if (!handler) continue;
            try {
                await handler.call(cb, event);
            } catch {
                // Observability must never break the completion.
            }
        }
    }

    /** Non-streaming completion with usage-aware load balancing + failover. */
    async completion(req: CompletionRequest): Promise<CompletionResult> {
        const maxAttempts = this.numRetries + 1;
        let lastError: unknown;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const index = this.pick(req.model);
            if (index == null) break;
            const dep = this.deployments[index];
            const adapter = getAdapter(dep.provider);
            const start = this.now();
            try {
                const built = adapter.buildRequest(dep, req, { stream: false });
                const res = await this.http.post(built.url, built.body, {
                    ...built.config,
                    timeout: dep.timeout ?? this.timeout,
                });
                const normalized = adapter.parseResponse(res.data);
                const usage = this.backfillUsage(normalized, req);
                this.recordSuccess(index, usage);
                const result: CompletionResult = {
                    content: normalized.content,
                    usage,
                    provider: dep.provider,
                    model: dep.providerModel || dep.model,
                    deploymentIndex: index,
                    functionCall: normalized.functionCall,
                    raw: res.data,
                };
                await this.notify("onSuccess", {
                    provider: dep.provider,
                    model: result.model,
                    deploymentIndex: index,
                    request: req,
                    usage,
                    response: result,
                    durationMs: this.now() - start,
                });
                return result;
            } catch (error) {
                lastError = error;
                this.recordFailure(index);
                await this.notify("onError", {
                    provider: dep.provider,
                    model: dep.providerModel || dep.model,
                    deploymentIndex: index,
                    request: req,
                    error,
                    durationMs: this.now() - start,
                });
            }
        }
        if (lastError) throw lastError;
        throw new NoDeploymentsAvailableError(req.model);
    }

    /** Embeddings with the same usage-aware load balancing + failover. */
    async embedding(req: EmbeddingRequest): Promise<EmbeddingResult> {
        const maxAttempts = this.numRetries + 1;
        let lastError: unknown;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const index = this.pick(req.model);
            if (index == null) break;
            const dep = this.deployments[index];
            const adapter = getAdapter(dep.provider);
            if (
                !adapter.supportsEmbeddings ||
                !adapter.buildEmbeddingRequest ||
                !adapter.parseEmbeddingResponse
            ) {
                throw new Error(`provider "${dep.provider}" does not support embeddings`);
            }
            const start = this.now();
            try {
                const built = adapter.buildEmbeddingRequest(dep, req);
                const res = await this.http.post(built.url, built.body, {
                    ...built.config,
                    timeout: dep.timeout ?? this.timeout,
                });
                const parsed = adapter.parseEmbeddingResponse(res.data);
                const usage =
                    parsed.usage.totalTokens > 0
                        ? parsed.usage
                        : this.estimateEmbeddingUsage(req);
                this.recordSuccess(index, usage);
                const result: EmbeddingResult = {
                    data: parsed.data,
                    usage,
                    provider: dep.provider,
                    model: dep.providerModel || dep.model,
                    deploymentIndex: index,
                    raw: res.data,
                };
                await this.notify("onSuccess", {
                    provider: dep.provider,
                    model: result.model,
                    deploymentIndex: index,
                    request: { model: req.model },
                    usage,
                    durationMs: this.now() - start,
                });
                return result;
            } catch (error) {
                lastError = error;
                this.recordFailure(index);
                await this.notify("onError", {
                    provider: dep.provider,
                    model: dep.providerModel || dep.model,
                    deploymentIndex: index,
                    request: { model: req.model },
                    error,
                    durationMs: this.now() - start,
                });
            }
        }
        if (lastError) throw lastError;
        throw new NoDeploymentsAvailableError(req.model);
    }

    private estimateEmbeddingUsage(req: EmbeddingRequest): TokenUsage {
        const text = Array.isArray(req.input) ? req.input.join("\n") : req.input;
        const promptTokens = estimateTokens(text);
        return { promptTokens, completionTokens: 0, totalTokens: promptTokens };
    }

    /**
     * Structured output via a zod schema. The schema is sent as an OpenAI
     * function definition and the returned arguments are parsed back through
     * zod, mirroring the litellm `response_format` / function-calling pattern.
     */
    async zodSchemaResponse<S extends z.ZodTypeAny>(opts: {
        model?: string;
        role?: RouterRole;
        max_tokens?: number;
        temperature?: number;
        prompt: string;
        schema: S;
    }): Promise<z.infer<S>> {
        const jsonSchema = zodToJsonSchema(opts.schema, { $refStrategy: "none" });
        const functionDefinition = {
            name: "generateSchema",
            description: "Generate a schema based on provided details.",
            parameters: jsonSchema,
        };
        const content = `
                        You are a Schema generator that can generate answer based on given prompt and then return the response based on the give schema
                        Remembrer if any field like url or link is not available please create a dummy link based on the following prompt

                        prompt:
                        ${opts.prompt || ""}
                        `;
        const result = await this.completion({
            model: opts.model,
            max_tokens: opts.max_tokens ?? 1000,
            temperature: opts.temperature,
            messages: [{ role: opts.role ?? "user", content }],
            functions: [functionDefinition],
            function_call: "auto",
        });
        if (result.content) return result.content as unknown as z.infer<S>;
        if (result.functionCall) {
            return opts.schema.parse(JSON.parse(result.functionCall.arguments));
        }
        throw new Error("Response did not contain valid JSON.");
    }

    /**
     * Streaming completion. Yields content deltas. Providers without a native
     * stream (palm) fall back to a single-shot completion emitted as one chunk.
     * Fail-over only happens before the first chunk is delivered.
     */
    async *stream(req: CompletionRequest): AsyncGenerator<string, void, unknown> {
        const maxAttempts = this.numRetries + 1;
        let lastError: unknown;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const index = this.pick(req.model);
            if (index == null) break;
            const dep = this.deployments[index];
            const adapter = getAdapter(dep.provider);
            const start = this.now();
            let started = false;
            try {
                if (!adapter.supportsStreaming) {
                    const built = adapter.buildRequest(dep, req, { stream: false });
                    const res = await this.http.post(built.url, built.body, {
                        ...built.config,
                        timeout: dep.timeout ?? this.timeout,
                    });
                    const normalized = adapter.parseResponse(res.data);
                    const usage = this.backfillUsage(normalized, req);
                    this.recordSuccess(index, usage);
                    await this.notifyStreamSuccess(index, dep, req, normalized.content, usage, start);
                    if (normalized.content) {
                        started = true;
                        yield normalized.content;
                    }
                    return;
                }

                const built = adapter.buildRequest(dep, req, { stream: true });
                const lines = this.http.stream(built.url, built.body, {
                    ...built.config,
                    timeout: dep.timeout ?? this.timeout,
                });
                let assembled = "";
                let streamUsage: TokenUsage | undefined;
                for await (const line of lines) {
                    const delta = adapter.parseStreamLine(line);
                    if (!delta) continue;
                    if (delta.usage) streamUsage = delta.usage;
                    if (delta.content) {
                        assembled += delta.content;
                        started = true;
                        yield delta.content;
                    }
                    if (delta.done) break;
                }
                const usage =
                    streamUsage ??
                    this.backfillUsage({ content: assembled, usage: zeroUsage() }, req);
                this.recordSuccess(index, usage);
                await this.notifyStreamSuccess(index, dep, req, assembled, usage, start);
                return;
            } catch (error) {
                lastError = error;
                this.recordFailure(index);
                await this.notify("onError", {
                    provider: dep.provider,
                    model: dep.providerModel || dep.model,
                    deploymentIndex: index,
                    request: req,
                    error,
                    durationMs: this.now() - start,
                });
                if (started) throw error; // cannot fail over mid-stream
            }
        }
        if (lastError) throw lastError;
        throw new NoDeploymentsAvailableError(req.model);
    }

    private async notifyStreamSuccess(
        index: number,
        dep: Deployment,
        req: CompletionRequest,
        content: string,
        usage: TokenUsage,
        start: number
    ): Promise<void> {
        const model = dep.providerModel || dep.model;
        await this.notify("onSuccess", {
            provider: dep.provider,
            model,
            deploymentIndex: index,
            request: req,
            usage,
            response: {
                content,
                usage,
                provider: dep.provider,
                model,
                deploymentIndex: index,
                raw: null,
            },
            durationMs: this.now() - start,
        });
    }

    /** Per-deployment cumulative usage. */
    getUsage(): DeploymentUsage[] {
        return this.deployments.map((d, i) => ({
            deploymentIndex: i,
            provider: d.provider,
            model: d.model,
            requests: this.states[i].totalRequests,
            promptTokens: this.states[i].promptTokens,
            completionTokens: this.states[i].completionTokens,
            totalTokens: this.states[i].totalTokens,
        }));
    }

    /** Aggregate usage across all deployments. */
    getTotalUsage(): TokenUsage & { requests: number } {
        return this.states.reduce(
            (acc, s) => ({
                requests: acc.requests + s.totalRequests,
                promptTokens: acc.promptTokens + s.promptTokens,
                completionTokens: acc.completionTokens + s.completionTokens,
                totalTokens: acc.totalTokens + s.totalTokens,
            }),
            { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        );
    }
}

function zeroUsage(): TokenUsage {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

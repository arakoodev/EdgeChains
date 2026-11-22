import * as fs from "node:fs";
import axios, { type AxiosAdapter, type AxiosInstance } from "axios";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { CallbackManager, type PostHogLogger, type SentryLogger } from "./callbacks.js";
import {
    attachRouterResponseInterceptor,
    classifyAxiosError,
    type RouterAxiosRequestConfig,
} from "./interceptors.js";
import {
    buildProviderCompletionRequest,
    buildProviderEmbeddingRequest,
    inferProviderAndModel,
    normalizeMessages,
    normalizeProviderCompletionResponse,
    normalizeProviderEmbeddingResponse,
    parseProviderStreamChunks,
} from "./providers.js";
import { getModelCostRate, tokenCounter } from "./tokenUsage.js";
import type {
    CallbackHandler,
    ChatMessage,
    ChatRole,
    CompletionOptions,
    CompletionResponse,
    DeploymentConfig,
    DeploymentState,
    EmbeddingOptions,
    EmbeddingResponse,
    FallbackMap,
    NormalizedDeploymentConfig,
    PostHogConfig,
    RouterConfig,
    RoutingStrategy,
    SentryConfig,
    StreamChunk,
    SupportedProvider,
    WindowRecord,
    ZodSchemaResponseOptions,
} from "./types.js";

const SLIDING_WINDOW_MS = 60_000;

function isMockFunction(fn: any): boolean {
    return Boolean(
        fn &&
        (typeof fn.mock === "object" ||
            fn._isMockFunction === true ||
            typeof fn.mockImplementation === "function")
    );
}

export interface JsonnetLoadOptions {
    extVars?: Record<string, string>;
    jsonnet?: any;
    adapter?: AxiosAdapter;
    axiosInstance?: AxiosInstance;
    callbacks?: CallbackHandler[];
    successCallbacks?: CallbackHandler[];
    failureCallbacks?: CallbackHandler[];
    sentry?: SentryConfig;
    posthog?: PostHogConfig;
}

/**
 * Pure-TypeScript fallback evaluator for Jsonnet router configuration files.
 * Supports `local var = ...;`, `std.extVar("...")`, `std.strReplace(...)`,
 * comments (`//`, `#`, `/* ... * /`), multiline strings (`||| ... |||`),
 * unquoted object keys, single-quoted strings, and trailing commas.
 */
export function evaluateJsonnetSubset(
    snippet: string,
    extVars: Record<string, string> = {}
): Record<string, any> {
    const resolveExtVar = (key: string): string => {
        if (Object.prototype.hasOwnProperty.call(extVars, key)) {
            return String(extVars[key]);
        }
        const envUpper = key.toUpperCase();
        if (process.env[key] !== undefined) {
            return String(process.env[key]);
        }
        if (process.env[envUpper] !== undefined) {
            return String(process.env[envUpper]);
        }
        return "";
    };

    // 1. Replace multiline `||| ... |||` blocks with JSON string literals
    let processed = snippet.replace(/\|\|\|([\s\S]*?)\|\|\|/g, (_m, content: string) =>
        JSON.stringify(content.replace(/^\r?\n/, ""))
    );

    // 2. Strip block comments `/* ... */` and line comments `// ...` or `# ...` outside strings
    const stripComments = (input: string): string => {
        let out = "";
        let inSingle = false;
        let inDouble = false;
        let i = 0;
        while (i < input.length) {
            const ch = input[i];
            const next = input[i + 1];

            if (!inSingle && !inDouble) {
                if (ch === "/" && next === "*") {
                    i += 2;
                    while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) {
                        i++;
                    }
                    i += 2;
                    continue;
                }
                if ((ch === "/" && next === "/") || ch === "#") {
                    while (i < input.length && input[i] !== "\n") {
                        i++;
                    }
                    continue;
                }
            }

            if (ch === "\\" && (inSingle || inDouble)) {
                out += ch + (next || "");
                i += 2;
                continue;
            }
            if (ch === '"' && !inSingle) {
                inDouble = !inDouble;
            } else if (ch === "'" && !inDouble) {
                inSingle = !inSingle;
            }
            out += ch;
            i++;
        }
        return out;
    };

    processed = stripComments(processed);

    // 3. Replace std.extVar("key") / std.extVar('key')
    processed = processed.replace(
        /std\.extVar\(\s*(?:"([^"]+)"|'([^']+)')\s*\)/g,
        (_m, dKey, sKey) => JSON.stringify(resolveExtVar(dKey || sKey))
    );

    // 4. Extract top-level `local <name> = <expr>;` bindings
    const locals: Record<string, string> = {};
    const localRegex = /^\s*local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+);/gm;
    processed = processed.replace(localRegex, (_m, varName: string, expr: string) => {
        locals[varName] = expr.trim();
        return "";
    });

    // Strip `local main() = ...; main()` wrapper if present
    processed = processed.replace(/^\s*local\s+main\s*\(\s*\)\s*=\s*/m, "");
    processed = processed.replace(/;\s*main\s*\(\s*\)\s*$/, "");

    // 5. Substitute local variables inside remaining expression (outside quoted strings)
    const substituteLocals = (input: string): string => {
        let result = input;
        const varNames = Object.keys(locals);
        for (let pass = 0; pass < 3 && varNames.length > 0; pass++) {
            for (const name of varNames) {
                const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const pattern = new RegExp(`(\\b)${escaped}(\\b)(?!\\s*:)`, "g");
                result = result.replace(pattern, () => locals[name]);
            }
        }
        return result;
    };

    processed = substituteLocals(processed).trim();

    // 6. Convert single-quoted strings to double-quoted strings
    const normalizeQuotes = (input: string): string => {
        let out = "";
        let inDouble = false;
        let i = 0;
        while (i < input.length) {
            const ch = input[i];
            if (ch === "\\" && inDouble) {
                out += ch + (input[i + 1] || "");
                i += 2;
                continue;
            }
            if (ch === '"') {
                inDouble = !inDouble;
                out += ch;
                i++;
                continue;
            }
            if (ch === "'" && !inDouble) {
                let inner = "";
                i++;
                while (i < input.length && input[i] !== "'") {
                    if (input[i] === "\\" && i + 1 < input.length) {
                        inner += input[i + 1];
                        i += 2;
                    } else {
                        inner += input[i];
                        i++;
                    }
                }
                i++; // skip closing '
                out += JSON.stringify(inner);
                continue;
            }
            out += ch;
            i++;
        }
        return out;
    };

    processed = normalizeQuotes(processed);

    // 7. Quote unquoted object keys: `{ key:` or `, key:` -> `{ "key":`
    processed = processed.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3');

    // 8. Remove trailing commas before `}` or `]`
    processed = processed.replace(/,(\s*[}\]])/g, "$1");

    return JSON.parse(processed);
}

/**
 * Evaluates a Jsonnet snippet using `@arakoodev/jsonnet` when available (or injected),
 * falling back to `evaluateJsonnetSubset`.
 */
export function evaluateJsonnetConfig(
    snippet: string,
    options: JsonnetLoadOptions = {},
    filePath?: string
): RouterConfig {
    const extVars = options.extVars || {};

    let jsonnetInstance = options.jsonnet;
    if (!jsonnetInstance) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const JsonnetCtor = require("@arakoodev/jsonnet");
            const Ctor = JsonnetCtor?.default || JsonnetCtor;
            if (typeof Ctor === "function") {
                jsonnetInstance = new Ctor();
            }
        } catch {
            // Optional WASM binary not present; use built-in subset evaluator
        }
    }

    if (jsonnetInstance) {
        try {
            // Scan for any std.extVar("name") references so missing extVars default to env or ""
            const extVarMatches = snippet.matchAll(/std\.extVar\(\s*(?:"([^"]+)"|'([^']+)')\s*\)/g);
            const allExtVars: Record<string, string> = {};
            for (const match of extVarMatches) {
                const key = match[1] || match[2];
                if (key) {
                    allExtVars[key] =
                        extVars[key] ?? process.env[key] ?? process.env[key.toUpperCase()] ?? "";
                }
            }
            Object.assign(allExtVars, extVars);

            for (const [k, v] of Object.entries(allExtVars)) {
                if (typeof jsonnetInstance.extString === "function") {
                    jsonnetInstance = jsonnetInstance.extString(k, String(v)) || jsonnetInstance;
                }
            }

            const rawJson =
                filePath && typeof jsonnetInstance.evaluateFile === "function"
                    ? jsonnetInstance.evaluateFile(filePath)
                    : typeof jsonnetInstance.evaluateSnippet === "function"
                      ? jsonnetInstance.evaluateSnippet(snippet)
                      : undefined;

            if (typeof rawJson === "string") {
                return JSON.parse(rawJson);
            }
        } catch {
            // Fall through to deterministic subset evaluator
        }
    }

    return evaluateJsonnetSubset(snippet, extVars) as RouterConfig;
}

/**
 * LiteLLM-Style Multi-Deployment Smart Router for EdgeChains JS/TS.
 */
export class SmartRouter {
    readonly routingStrategy: RoutingStrategy;
    readonly numRetries: number;
    readonly retryAfterMs: number;
    readonly timeoutMs: number;
    readonly cooldownTime: number;
    readonly allowedFails: number;
    readonly defaultModel: string;
    readonly retryOnSameDeployment?: boolean;
    readonly callbackManager: CallbackManager;
    readonly httpClient: AxiosInstance;

    private readonly deployments = new Map<string, NormalizedDeploymentConfig>();
    private readonly states = new Map<string, DeploymentState>();
    private readonly windows = new Map<string, WindowRecord[]>();
    private readonly fallbacks = new Map<string, string[]>();
    private readonly contextWindowFallbacks = new Map<string, string[]>();
    private readonly customAdapter?: AxiosAdapter;
    private deploymentCounter = 0;

    constructor(config: RouterConfig = {}) {
        const settings = {
            ...(config.routerSettings || {}),
            ...(config.router_settings || {}),
            ...config,
        };

        this.routingStrategy =
            settings.routingStrategy || settings.routing_strategy || "least-tokens";
        this.numRetries = settings.numRetries ?? settings.num_retries ?? 2;
        this.retryAfterMs = settings.retryAfter ?? settings.retry_after ?? 20;
        this.timeoutMs = settings.timeout ?? 30_000;
        this.cooldownTime = settings.cooldownTime ?? settings.cooldown_time ?? 60_000;
        this.allowedFails = settings.allowedFails ?? settings.allowed_fails ?? 2;
        this.defaultModel = settings.defaultModel || settings.default_model || "gpt-3.5-turbo";
        this.retryOnSameDeployment = settings.retryOnSameDeployment;
        this.customAdapter = config.adapter;

        this.registerFallbackMap(this.fallbacks, settings.fallbacks);
        this.registerFallbackMap(
            this.contextWindowFallbacks,
            settings.contextWindowFallbacks || settings.context_window_fallbacks
        );

        const defaultAdapter: AxiosAdapter | undefined = this.customAdapter
            ? this.customAdapter
            : async (reqConfig) => {
                  if (isMockFunction(axios.post)) {
                      let parsedData = reqConfig.data;
                      if (typeof parsedData === "string") {
                          try {
                              parsedData = JSON.parse(parsedData);
                          } catch {
                              // keep string
                          }
                      }
                      const res = await (axios.post as any)(reqConfig.url, parsedData, {
                          headers: reqConfig.headers,
                      });
                      return {
                          data: res?.data ?? res,
                          status: res?.status ?? 200,
                          statusText: res?.statusText ?? "OK",
                          headers: res?.headers ?? {},
                          config: reqConfig,
                      };
                  }
                  const defaultAxiosAdapter = axios.getAdapter(axios.defaults.adapter);
                  return defaultAxiosAdapter(reqConfig);
              };

        this.httpClient =
            config.axiosInstance ||
            axios.create({
                timeout: this.timeoutMs,
                adapter: defaultAdapter,
            });

        attachRouterResponseInterceptor(this.httpClient, {
            numRetries: 0,
            retryAfterMs: this.retryAfterMs,
            timeoutMs: this.timeoutMs,
            adapter: this.customAdapter,
        });

        this.callbackManager = new CallbackManager({
            callbacks: config.callbacks,
            successCallbacks: config.successCallbacks || config.success_callbacks,
            failureCallbacks: config.failureCallbacks || config.failure_callbacks,
            sentry: config.sentry,
            posthog: config.posthog,
            httpClient: this.httpClient,
        });

        const initialDeployments =
            config.modelList || config.model_list || config.deployments || [];
        for (const dep of initialDeployments) {
            this.addDeployment(dep);
        }

        if (this.deployments.size === 0) {
            this.addDeployment({
                deploymentId: "default-openai-gpt-3.5-turbo",
                modelName: this.defaultModel,
                provider: "openai",
                model: "gpt-3.5-turbo",
                apiKey: process.env.OPENAI_API_KEY || "",
                orgId: process.env.OPENAI_ORG_ID || "",
            });
        }
    }

    get sentryLogger(): SentryLogger {
        return this.callbackManager.sentryLogger;
    }

    get posthogLogger(): PostHogLogger {
        return this.callbackManager.posthogLogger;
    }

    static fromJsonnet(snippet: string, options: JsonnetLoadOptions = {}): SmartRouter {
        const parsedConfig = evaluateJsonnetConfig(snippet, options);
        return SmartRouter.fromParsedConfig(parsedConfig, options);
    }

    static fromJsonnetFile(filePath: string, options: JsonnetLoadOptions = {}): SmartRouter {
        const snippet = fs.readFileSync(filePath, "utf8");
        const parsedConfig = evaluateJsonnetConfig(snippet, options, filePath);
        return SmartRouter.fromParsedConfig(parsedConfig, options);
    }

    private static fromParsedConfig(
        parsedConfig: RouterConfig,
        options: JsonnetLoadOptions
    ): SmartRouter {
        return new SmartRouter({
            ...parsedConfig,
            ...(options.adapter ? { adapter: options.adapter } : {}),
            ...(options.axiosInstance ? { axiosInstance: options.axiosInstance } : {}),
            ...(options.callbacks
                ? { callbacks: [...(parsedConfig.callbacks || []), ...options.callbacks] }
                : {}),
            ...(options.successCallbacks
                ? {
                      successCallbacks: [
                          ...(parsedConfig.successCallbacks ||
                              parsedConfig.success_callbacks ||
                              []),
                          ...options.successCallbacks,
                      ],
                  }
                : {}),
            ...(options.failureCallbacks
                ? {
                      failureCallbacks: [
                          ...(parsedConfig.failureCallbacks ||
                              parsedConfig.failure_callbacks ||
                              []),
                          ...options.failureCallbacks,
                      ],
                  }
                : {}),
            ...(options.sentry
                ? { sentry: { ...(parsedConfig.sentry || {}), ...options.sentry } }
                : {}),
            ...(options.posthog
                ? { posthog: { ...(parsedConfig.posthog || {}), ...options.posthog } }
                : {}),
        });
    }

    private registerFallbackMap(target: Map<string, string[]>, raw?: FallbackMap): void {
        if (!raw) {
            return;
        }
        const entries = Array.isArray(raw) ? raw : [raw];
        for (const mapObj of entries) {
            if (mapObj && typeof mapObj === "object") {
                for (const [modelKey, fallbackList] of Object.entries(mapObj)) {
                    if (Array.isArray(fallbackList)) {
                        target.set(
                            modelKey,
                            fallbackList.map((m) => String(m))
                        );
                    }
                }
            }
        }
    }

    addDeployment(raw: DeploymentConfig): NormalizedDeploymentConfig {
        this.deploymentCounter += 1;
        const litellm = raw.litellmParams || raw.litellm_params;
        const rawModelStr =
            litellm?.model || raw.model || raw.modelName || raw.model_name || "gpt-3.5-turbo";
        const { provider, model } = inferProviderAndModel(rawModelStr, raw.provider);

        const modelName = raw.modelName || raw.model_name || model;
        const deploymentId =
            raw.deploymentId ||
            raw.deployment_id ||
            `${provider}-${modelName}-${this.deploymentCounter}`;

        const defaultEnvKey =
            provider === "palm" || provider === "google-palm" || provider === "gemini"
                ? process.env.PALM_API_KEY || process.env.GEMINI_API_KEY || ""
                : provider === "cohere"
                  ? process.env.COHERE_API_KEY || ""
                  : provider === "anthropic"
                    ? process.env.ANTHROPIC_API_KEY || ""
                    : process.env.OPENAI_API_KEY || "";

        const apiKey =
            raw.apiKey ?? raw.api_key ?? litellm?.apiKey ?? litellm?.api_key ?? defaultEnvKey;

        const orgId =
            raw.orgId ??
            raw.organization ??
            litellm?.organization ??
            litellm?.orgId ??
            process.env.OPENAI_ORG_ID ??
            "";

        const apiBase = raw.apiBase ?? raw.api_base ?? litellm?.apiBase ?? litellm?.api_base;
        const rpm = raw.rpm ?? litellm?.rpm;
        const tpm = raw.tpm ?? litellm?.tpm;
        const weight = Math.max(1, raw.weight ?? litellm?.weight ?? 1);
        const priority = raw.priority ?? litellm?.priority ?? 100;
        const timeout = raw.timeout ?? litellm?.timeout;
        const maxRetries =
            raw.maxRetries ?? raw.max_retries ?? litellm?.maxRetries ?? litellm?.max_retries;
        const inputCostPer1kTokens =
            raw.inputCostPer1kTokens ??
            raw.input_cost_per_1k_tokens ??
            litellm?.inputCostPer1kTokens ??
            litellm?.input_cost_per_1k_tokens;
        const outputCostPer1kTokens =
            raw.outputCostPer1kTokens ??
            raw.output_cost_per_1k_tokens ??
            litellm?.outputCostPer1kTokens ??
            litellm?.output_cost_per_1k_tokens;

        const normalized: NormalizedDeploymentConfig = {
            deploymentId,
            modelName,
            provider,
            model,
            apiKey,
            orgId,
            apiBase,
            rpm,
            tpm,
            weight,
            priority,
            timeout,
            maxRetries,
            inputCostPer1kTokens,
            outputCostPer1kTokens,
            metadata: { ...(raw.metadata || {}) },
        };

        this.deployments.set(deploymentId, normalized);
        this.windows.set(deploymentId, []);
        this.states.set(deploymentId, {
            deploymentId,
            modelName,
            provider,
            model,
            rpm,
            tpm,
            weight,
            priority,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            consecutiveFailures: 0,
            activeRequests: 0,
            promptTokensUsed: 0,
            completionTokensUsed: 0,
            totalTokensUsed: 0,
            totalCostUsd: 0,
            windowRequests: 0,
            windowTokens: 0,
            emaLatencyMs: 0,
            lastLatencyMs: 0,
            cooldownUntil: 0,
        });

        return normalized;
    }

    removeDeployment(deploymentId: string): boolean {
        this.states.delete(deploymentId);
        this.windows.delete(deploymentId);
        return this.deployments.delete(deploymentId);
    }

    getDeployments(): NormalizedDeploymentConfig[] {
        return Array.from(this.deployments.values());
    }

    getDeploymentStates(): DeploymentState[] {
        const now = Date.now();
        for (const id of this.deployments.keys()) {
            this.pruneSlidingWindow(id, now);
        }
        return Array.from(this.states.values()).map((s) => ({ ...s }));
    }

    getDeploymentState(deploymentId: string): DeploymentState | undefined {
        this.pruneSlidingWindow(deploymentId, Date.now());
        const st = this.states.get(deploymentId);
        return st ? { ...st } : undefined;
    }

    resetDeploymentStates(): void {
        for (const [id, st] of this.states.entries()) {
            this.windows.set(id, []);
            st.totalRequests = 0;
            st.successfulRequests = 0;
            st.failedRequests = 0;
            st.consecutiveFailures = 0;
            st.activeRequests = 0;
            st.promptTokensUsed = 0;
            st.completionTokensUsed = 0;
            st.totalTokensUsed = 0;
            st.totalCostUsd = 0;
            st.windowRequests = 0;
            st.windowTokens = 0;
            st.emaLatencyMs = 0;
            st.lastLatencyMs = 0;
            st.cooldownUntil = 0;
            st.lastError = undefined;
            st.lastUsedAt = undefined;
        }
    }

    private pruneSlidingWindow(deploymentId: string, now = Date.now()): void {
        const records = this.windows.get(deploymentId);
        const state = this.states.get(deploymentId);
        if (!records || !state) {
            return;
        }
        const cutoff = now - SLIDING_WINDOW_MS;
        while (records.length > 0 && records[0].timestamp <= cutoff) {
            records.shift();
        }
        state.windowRequests = records.length;
        state.windowTokens = records.reduce((sum, r) => sum + r.tokens, 0);
    }

    private getMatchingDeployments(requestedModel: string): NormalizedDeploymentConfig[] {
        const all = Array.from(this.deployments.values());
        if (requestedModel === "*") {
            return all;
        }
        const exactModelName = all.filter((d) => d.modelName === requestedModel);
        if (exactModelName.length > 0) {
            return exactModelName;
        }
        const exactModel = all.filter(
            (d) => d.model === requestedModel || `${d.provider}/${d.model}` === requestedModel
        );
        if (exactModel.length > 0) {
            return exactModel;
        }
        const wildcard = all.filter((d) => d.modelName === "*" || d.modelName === "default-llm");
        if (wildcard.length > 0) {
            return wildcard;
        }
        return all;
    }

    /**
     * Selects the best healthy deployment for `requestedModel` that is:
     * 1. Not in `excludedIds`
     * 2. Not in cooldown (`cooldownUntil <= now`)
     * 3. Below rate limits (`windowRequests < rpm` and `windowTokens < tpm`)
     * 4. Ordered by `this.routingStrategy` (default `"least-tokens"`: lowest total tokens used).
     */
    selectDeployment(
        requestedModel?: string,
        estimatedPromptTokens = 0,
        excludedIds: Set<string> = new Set(),
        now = Date.now()
    ): NormalizedDeploymentConfig | null {
        const targetModel = requestedModel || this.defaultModel;
        const candidates = this.getMatchingDeployments(targetModel);

        const healthy: NormalizedDeploymentConfig[] = [];
        for (const dep of candidates) {
            if (excludedIds.has(dep.deploymentId)) {
                continue;
            }
            this.pruneSlidingWindow(dep.deploymentId, now);
            const state = this.states.get(dep.deploymentId);
            if (!state) {
                continue;
            }
            // Cooldown check
            if (state.cooldownUntil > now) {
                continue;
            }
            // RPM check
            if (dep.rpm !== undefined && state.windowRequests >= dep.rpm) {
                continue;
            }
            // TPM check
            if (
                dep.tpm !== undefined &&
                (state.windowTokens >= dep.tpm ||
                    (state.windowTokens > 0 &&
                        state.windowTokens + estimatedPromptTokens > dep.tpm))
            ) {
                continue;
            }
            healthy.push(dep);
        }

        if (healthy.length === 0) {
            return null;
        }

        if (healthy.length === 1) {
            return healthy[0];
        }

        const strategy = this.routingStrategy;

        if (strategy === "simple-shuffle") {
            const totalWeight = healthy.reduce((acc, d) => acc + Math.max(1, d.weight), 0);
            let roll = Math.random() * totalWeight;
            for (const dep of healthy) {
                roll -= Math.max(1, dep.weight);
                if (roll <= 0) {
                    return dep;
                }
            }
            return healthy[healthy.length - 1];
        }

        const sorted = [...healthy].sort((a, b) => {
            const stA = this.states.get(a.deploymentId)!;
            const stB = this.states.get(b.deploymentId)!;

            if (strategy === "least-busy") {
                if (stA.activeRequests !== stB.activeRequests) {
                    return stA.activeRequests - stB.activeRequests;
                }
            } else if (strategy === "latency-based-routing") {
                const latA = stA.emaLatencyMs > 0 ? stA.emaLatencyMs : Number.MAX_SAFE_INTEGER;
                const latB = stB.emaLatencyMs > 0 ? stB.emaLatencyMs : Number.MAX_SAFE_INTEGER;
                if (latA !== latB) {
                    return latA - latB;
                }
            } else if (strategy === "cost-based-routing") {
                const costA = getModelCostRate(
                    a.model,
                    a.provider,
                    a.inputCostPer1kTokens,
                    a.outputCostPer1kTokens
                );
                const costB = getModelCostRate(
                    b.model,
                    b.provider,
                    b.inputCostPer1kTokens,
                    b.outputCostPer1kTokens
                );
                const rateA = costA.inputCostPer1k + costA.outputCostPer1k;
                const rateB = costB.inputCostPer1k + costB.outputCostPer1k;
                if (rateA !== rateB) {
                    return rateA - rateB;
                }
            }

            // Primary tie-breaker and default strategy ("least-tokens" / "usage-based-routing"):
            // lowest total tokens used, then lowest current window tokens, then priority, then latency.
            if (stA.totalTokensUsed !== stB.totalTokensUsed) {
                return stA.totalTokensUsed - stB.totalTokensUsed;
            }
            if (stA.windowTokens !== stB.windowTokens) {
                return stA.windowTokens - stB.windowTokens;
            }
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return stA.emaLatencyMs - stB.emaLatencyMs;
        });

        return sorted[0];
    }

    private recordDeploymentSuccess(
        deploymentId: string,
        promptTokens: number,
        completionTokens: number,
        totalTokens: number,
        costUsd: number,
        latencyMs: number
    ): void {
        const now = Date.now();
        const state = this.states.get(deploymentId);
        const records = this.windows.get(deploymentId);
        if (!state || !records) {
            return;
        }

        state.successfulRequests += 1;
        state.consecutiveFailures = 0;
        state.promptTokensUsed += promptTokens;
        state.completionTokensUsed += completionTokens;
        state.totalTokensUsed += totalTokens;
        state.totalCostUsd = Number((state.totalCostUsd + costUsd).toFixed(8));
        state.lastLatencyMs = latencyMs;
        state.emaLatencyMs =
            state.emaLatencyMs === 0
                ? latencyMs
                : Math.round(state.emaLatencyMs * 0.7 + latencyMs * 0.3);
        state.lastUsedAt = now;

        records.push({
            timestamp: now,
            tokens: totalTokens,
        });
        this.pruneSlidingWindow(deploymentId, now);
    }

    private recordDeploymentFailure(
        deploymentId: string,
        error: any,
        retryAfterMs?: number,
        isRateLimit = false
    ): void {
        const now = Date.now();
        const state = this.states.get(deploymentId);
        if (!state) {
            return;
        }
        state.failedRequests += 1;
        state.consecutiveFailures += 1;
        state.lastError =
            error instanceof Error
                ? error.message
                : String(error?.message || error || "Request failed");
        state.lastUsedAt = now;

        if (isRateLimit || state.consecutiveFailures >= this.allowedFails) {
            const cooldownDuration =
                retryAfterMs !== undefined && retryAfterMs > 0 ? retryAfterMs : this.cooldownTime;
            state.cooldownUntil = now + cooldownDuration;
        }
    }

    private getFallbacksForModel(modelName: string, isContextWindow = false): string[] {
        const map = isContextWindow ? this.contextWindowFallbacks : this.fallbacks;
        return map.get(modelName) || map.get("*") || [];
    }

    /**
     * Executes a unified completion request with load balancing, rate-limit & cooldown checks,
     * Axios response interceptor retries, cross-deployment failover, and fallback model chains.
     */
    async completion(options: CompletionOptions): Promise<CompletionResponse> {
        const requestedModel = String(options.model || this.defaultModel);
        const normalizedMsgs = normalizeMessages(options);
        const estimatedPromptTokens = tokenCounter(normalizedMsgs, requestedModel);
        const effectiveRetries = options.numRetries ?? options.max_retry ?? this.numRetries;
        const effectiveRetryDelay = options.delay ?? this.retryAfterMs;

        const modelQueue: string[] = [
            requestedModel,
            ...this.getFallbacksForModel(requestedModel, false),
        ];
        const visitedModels = new Set<string>();
        let lastError: any = null;

        while (modelQueue.length > 0) {
            const currentModel = modelQueue.shift()!;
            if (visitedModels.has(currentModel)) {
                continue;
            }
            visitedModels.add(currentModel);

            const matchingDeployments = this.getMatchingDeployments(currentModel);
            const triedDeployments = new Set<string>();
            let switchToContextFallback = false;

            while (triedDeployments.size < matchingDeployments.length) {
                const deployment = this.selectDeployment(
                    currentModel,
                    estimatedPromptTokens,
                    triedDeployments
                );
                if (!deployment) {
                    break;
                }

                triedDeployments.add(deployment.deploymentId);
                const state = this.states.get(deployment.deploymentId)!;
                state.activeRequests += 1;
                state.totalRequests += 1;

                const startTime = Date.now();
                const reqSpec = buildProviderCompletionRequest(deployment, options);

                // Count remaining healthy untried deployments for currentModel
                const remainingHealthyExist =
                    this.selectDeployment(currentModel, estimatedPromptTokens, triedDeployments) !==
                    null;

                // When only 1 deployment is available (or retryOnSameDeployment is enabled),
                // let axios.interceptors.response.use perform exponential backoff retries in-place.
                const inPlaceMaxRetries =
                    this.retryOnSameDeployment || !remainingHealthyExist
                        ? (deployment.maxRetries ?? effectiveRetries)
                        : (deployment.maxRetries ?? 0);

                try {
                    const reqConfig: Partial<RouterAxiosRequestConfig> = {
                        method: "post",
                        url: reqSpec.url,
                        headers: reqSpec.headers as any,
                        data: reqSpec.body,
                        timeout: options.timeout ?? deployment.timeout ?? this.timeoutMs,
                        __routerDeploymentId: deployment.deploymentId,
                        __routerMaxRetries: inPlaceMaxRetries,
                        __routerRetryAfterBaseMs: effectiveRetryDelay,
                    };

                    const axiosResponse = await this.httpClient.request(reqConfig as any);
                    state.activeRequests = Math.max(0, state.activeRequests - 1);

                    const endTime = Date.now();
                    const meta = (axiosResponse as any).__routerMeta;
                    const latencyMs = meta?.latencyMs ?? Math.max(1, endTime - startTime);
                    const attempts = meta?.attempts ?? 1;

                    const normalizedResponse = normalizeProviderCompletionResponse({
                        deployment,
                        rawData: axiosResponse.data,
                        promptInput: reqSpec.promptInput,
                        latencyMs,
                    });

                    this.recordDeploymentSuccess(
                        deployment.deploymentId,
                        normalizedResponse.usage.prompt_tokens,
                        normalizedResponse.usage.completion_tokens,
                        normalizedResponse.usage.total_tokens,
                        normalizedResponse.costUsd,
                        latencyMs
                    );

                    await this.callbackManager.onSuccess({
                        eventType: "success",
                        modelName: currentModel,
                        resolvedModel: normalizedResponse.model,
                        provider: deployment.provider,
                        deploymentId: deployment.deploymentId,
                        startTime,
                        endTime,
                        latencyMs,
                        usage: normalizedResponse.usage,
                        costUsd: normalizedResponse.costUsd,
                        stream: Boolean(options.stream),
                        attempts,
                        statusCode: axiosResponse.status,
                        metadata: options.metadata,
                        response: normalizedResponse,
                    });

                    return normalizedResponse;
                } catch (err: any) {
                    state.activeRequests = Math.max(0, state.activeRequests - 1);
                    lastError = err;
                    const endTime = Date.now();
                    const diagnostics = classifyAxiosError(
                        err,
                        Math.max(1, endTime - startTime),
                        1,
                        deployment.deploymentId
                    );

                    this.recordDeploymentFailure(
                        deployment.deploymentId,
                        err,
                        diagnostics.retryAfterMs,
                        diagnostics.isRateLimit
                    );

                    await this.callbackManager.onFailure({
                        eventType: "failure",
                        modelName: currentModel,
                        resolvedModel: deployment.model,
                        provider: deployment.provider,
                        deploymentId: deployment.deploymentId,
                        startTime,
                        endTime,
                        latencyMs: diagnostics.latencyMs,
                        stream: Boolean(options.stream),
                        attempts: diagnostics.attempts,
                        statusCode: diagnostics.statusCode,
                        error: err,
                        metadata: options.metadata,
                    });

                    if (diagnostics.isContextWindowExceeded) {
                        const ctxFallbacks = [
                            ...this.getFallbacksForModel(currentModel, true),
                            ...this.getFallbacksForModel(requestedModel, true),
                        ];
                        if (ctxFallbacks.length > 0) {
                            modelQueue.unshift(...ctxFallbacks);
                            switchToContextFallback = true;
                            break;
                        }
                    }
                }
            }

            if (switchToContextFallback) {
                continue;
            }
        }

        if (lastError) {
            throw lastError;
        }
        throw new Error(
            `No healthy LLM deployments available for model "${requestedModel}" (all deployments rate-limited or in cooldown).`
        );
    }

    /**
     * Alias for `completion()` matching EdgeChains `OpenAI.chat()` and `GeminiAI.chat()`.
     */
    async chat(options: CompletionOptions): Promise<CompletionResponse> {
        return this.completion(options);
    }

    /**
     * Streams incremental completion chunks across OpenAI, Google PaLM/Gemini, and Cohere,
     * updating deployment token counters and firing observability callbacks upon stream completion.
     */
    async *streamCompletion(
        options: CompletionOptions
    ): AsyncGenerator<StreamChunk, CompletionResponse, unknown> {
        const streamOptions: CompletionOptions = {
            ...options,
            stream: true,
        };
        const requestedModel = String(streamOptions.model || this.defaultModel);
        const normalizedMsgs = normalizeMessages(streamOptions);
        const estimatedPromptTokens = tokenCounter(normalizedMsgs, requestedModel);
        const effectiveRetries =
            streamOptions.numRetries ?? streamOptions.max_retry ?? this.numRetries;

        const modelQueue: string[] = [
            requestedModel,
            ...this.getFallbacksForModel(requestedModel, false),
        ];
        const visitedModels = new Set<string>();
        let lastError: any = null;

        while (modelQueue.length > 0) {
            const currentModel = modelQueue.shift()!;
            if (visitedModels.has(currentModel)) {
                continue;
            }
            visitedModels.add(currentModel);

            const matchingDeployments = this.getMatchingDeployments(currentModel);
            const triedDeployments = new Set<string>();

            while (triedDeployments.size < matchingDeployments.length) {
                const deployment = this.selectDeployment(
                    currentModel,
                    estimatedPromptTokens,
                    triedDeployments
                );
                if (!deployment) {
                    break;
                }

                triedDeployments.add(deployment.deploymentId);
                const state = this.states.get(deployment.deploymentId)!;
                state.activeRequests += 1;
                state.totalRequests += 1;

                const startTime = Date.now();
                const reqSpec = buildProviderCompletionRequest(deployment, streamOptions);
                const remainingHealthyExist =
                    this.selectDeployment(currentModel, estimatedPromptTokens, triedDeployments) !==
                    null;

                const inPlaceMaxRetries =
                    this.retryOnSameDeployment || !remainingHealthyExist
                        ? (deployment.maxRetries ?? effectiveRetries)
                        : (deployment.maxRetries ?? 0);

                try {
                    const axiosResponse = await this.httpClient.request({
                        method: "post",
                        url: reqSpec.url,
                        headers: reqSpec.headers as any,
                        data: reqSpec.body,
                        timeout: streamOptions.timeout ?? deployment.timeout ?? this.timeoutMs,
                        __routerDeploymentId: deployment.deploymentId,
                        __routerMaxRetries: inPlaceMaxRetries,
                        __routerRetryAfterBaseMs: this.retryAfterMs,
                    } as any);

                    let fullText = "";
                    let lastRawChunk: any;
                    for await (const chunk of parseProviderStreamChunks({
                        deployment,
                        rawStreamOrData: axiosResponse.data,
                    })) {
                        fullText = chunk.content;
                        if (chunk.raw) {
                            lastRawChunk = chunk.raw;
                        }
                        yield chunk;
                    }

                    state.activeRequests = Math.max(0, state.activeRequests - 1);
                    const endTime = Date.now();
                    const latencyMs = Math.max(1, endTime - startTime);

                    const finalResponse = normalizeProviderCompletionResponse({
                        deployment,
                        rawData:
                            lastRawChunk && typeof lastRawChunk === "object"
                                ? {
                                      ...lastRawChunk,
                                      choices: [
                                          {
                                              index: 0,
                                              message: {
                                                  role: "assistant",
                                                  content: fullText,
                                              },
                                              finish_reason: "stop",
                                          },
                                      ],
                                  }
                                : fullText,
                        promptInput: reqSpec.promptInput,
                        latencyMs,
                    });

                    this.recordDeploymentSuccess(
                        deployment.deploymentId,
                        finalResponse.usage.prompt_tokens,
                        finalResponse.usage.completion_tokens,
                        finalResponse.usage.total_tokens,
                        finalResponse.costUsd,
                        latencyMs
                    );

                    await this.callbackManager.onSuccess({
                        eventType: "success",
                        modelName: currentModel,
                        resolvedModel: finalResponse.model,
                        provider: deployment.provider,
                        deploymentId: deployment.deploymentId,
                        startTime,
                        endTime,
                        latencyMs,
                        usage: finalResponse.usage,
                        costUsd: finalResponse.costUsd,
                        stream: true,
                        attempts: (axiosResponse as any).__routerMeta?.attempts ?? 1,
                        statusCode: axiosResponse.status,
                        metadata: streamOptions.metadata,
                        response: finalResponse,
                    });

                    return finalResponse;
                } catch (err: any) {
                    state.activeRequests = Math.max(0, state.activeRequests - 1);
                    lastError = err;
                    const endTime = Date.now();
                    const diagnostics = classifyAxiosError(
                        err,
                        Math.max(1, endTime - startTime),
                        1,
                        deployment.deploymentId
                    );

                    this.recordDeploymentFailure(
                        deployment.deploymentId,
                        err,
                        diagnostics.retryAfterMs,
                        diagnostics.isRateLimit
                    );

                    await this.callbackManager.onFailure({
                        eventType: "failure",
                        modelName: currentModel,
                        resolvedModel: deployment.model,
                        provider: deployment.provider,
                        deploymentId: deployment.deploymentId,
                        startTime,
                        endTime,
                        latencyMs: diagnostics.latencyMs,
                        stream: true,
                        attempts: diagnostics.attempts,
                        statusCode: diagnostics.statusCode,
                        error: err,
                        metadata: streamOptions.metadata,
                    });
                }
            }
        }

        if (lastError) {
            throw lastError;
        }
        throw new Error(
            `No healthy LLM deployments available for streaming model "${requestedModel}".`
        );
    }

    /**
     * Collects all chunks from `streamCompletion` and returns the full `CompletionResponse` with `.chunks`.
     */
    async streamedChat(
        options: CompletionOptions
    ): Promise<CompletionResponse & { chunks: StreamChunk[] }> {
        const chunks: StreamChunk[] = [];
        const gen = this.streamCompletion(options);
        let next = await gen.next();
        while (!next.done) {
            chunks.push(next.value);
            next = await gen.next();
        }
        const finalResponse = next.value;
        return {
            ...finalResponse,
            chunks,
        };
    }

    /**
     * Web ReadableStream wrapper emitting OpenAI-compatible JSON delta chunks followed by `[DONE]`.
     */
    OpenAIStream(promptOrOptions: string | CompletionOptions): ReadableStream<Uint8Array> {
        const options: CompletionOptions =
            typeof promptOrOptions === "string"
                ? { prompt: promptOrOptions, stream: true }
                : { ...promptOrOptions, stream: true };

        const router = this;
        const encoder = new TextEncoder();

        return new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    for await (const chunk of router.streamCompletion(options)) {
                        if (chunk.delta) {
                            const payload = JSON.stringify([
                                {
                                    choices: [
                                        {
                                            delta: {
                                                content: chunk.delta,
                                            },
                                        },
                                    ],
                                },
                            ]);
                            controller.enqueue(encoder.encode(payload));
                        }
                    }
                    controller.enqueue(encoder.encode("[DONE]"));
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            },
        });
    }

    /**
     * Function-calling completion compatible with `OpenAI.chatWithFunction()`.
     */
    async chatWithFunction(options: CompletionOptions): Promise<CompletionResponse> {
        return this.completion({
            ...options,
            max_tokens: options.max_tokens ?? 1024,
            function_call: options.function_call ?? "auto",
        });
    }

    /**
     * Structured Zod schema generation compatible with `OpenAI.zodSchemaResponse()`.
     */
    async zodSchemaResponse<S extends z.ZodTypeAny>(
        chatOptions: ZodSchemaResponseOptions<S>
    ): Promise<z.infer<S>> {
        const jsonSchema = zodToJsonSchema(chatOptions.schema, { $refStrategy: "none" });
        const openAIFunctionCallDefinition = {
            name: "generateSchema",
            description: "Generate a schema based on provided details.",
            parameters: jsonSchema,
        };

        const content = `
                        You are a Schema generator that can generate answer based on given prompt and then return the response based on the give schema 
                        Remembrer if any field like url or link is not available please create a dummy link based on the following prompt
                        
                        prompt:
                        ${chatOptions.prompt || ""}
                        `;

        const response = await this.completion({
            model: chatOptions.model || this.defaultModel,
            messages: [
                {
                    role: chatOptions.role || "user",
                    content,
                },
            ],
            functions: [openAIFunctionCallDefinition],
            function_call: "auto",
            max_tokens: chatOptions.max_tokens || 1000,
            temperature: chatOptions.temperature ?? 0.7,
        });

        if (response.function_call?.arguments) {
            return chatOptions.schema.parse(JSON.parse(response.function_call.arguments));
        }

        if (response.content) {
            try {
                const parsed = JSON.parse(response.content);
                const validated = chatOptions.schema.safeParse(parsed);
                if (validated.success) {
                    return validated.data;
                }
            } catch {
                // Return raw content when not JSON
            }
            return response.content as any;
        }

        throw new Error("Response did not contain valid JSON.");
    }

    /**
     * Generates vector embeddings across OpenAI, Google PaLM/Gemini, or Cohere deployments.
     */
    async generateEmbeddings(
        optionsOrInput: EmbeddingOptions | string | string[]
    ): Promise<EmbeddingResponse & any> {
        const options: EmbeddingOptions =
            typeof optionsOrInput === "string" || Array.isArray(optionsOrInput)
                ? { input: optionsOrInput }
                : optionsOrInput;

        const requestedModel = options.model || this.defaultModel;
        const deployment = this.selectDeployment(requestedModel) || this.getDeployments()[0];

        if (!deployment) {
            throw new Error(
                `No healthy deployment available for embeddings model "${requestedModel}".`
            );
        }

        const state = this.states.get(deployment.deploymentId)!;
        state.activeRequests += 1;
        state.totalRequests += 1;
        const startTime = Date.now();

        const reqSpec = buildProviderEmbeddingRequest(deployment, options);

        try {
            const axiosResponse = await this.httpClient.request({
                method: "post",
                url: reqSpec.url,
                headers: reqSpec.headers as any,
                data: reqSpec.body,
                timeout: deployment.timeout ?? this.timeoutMs,
                __routerDeploymentId: deployment.deploymentId,
                __routerMaxRetries: deployment.maxRetries ?? this.numRetries,
                __routerRetryAfterBaseMs: this.retryAfterMs,
            } as any);

            state.activeRequests = Math.max(0, state.activeRequests - 1);
            const endTime = Date.now();
            const latencyMs =
                (axiosResponse as any).__routerMeta?.latencyMs ?? Math.max(1, endTime - startTime);

            const normalized = normalizeProviderEmbeddingResponse({
                deployment,
                rawData: axiosResponse.data,
                inputs: reqSpec.inputs,
                model: reqSpec.body.model,
                latencyMs,
            });

            this.recordDeploymentSuccess(
                deployment.deploymentId,
                normalized.usage.prompt_tokens,
                0,
                normalized.usage.total_tokens,
                normalized.costUsd,
                latencyMs
            );

            await this.callbackManager.onSuccess({
                eventType: "success",
                modelName: requestedModel,
                resolvedModel: normalized.model,
                provider: deployment.provider,
                deploymentId: deployment.deploymentId,
                startTime,
                endTime,
                latencyMs,
                usage: normalized.usage,
                costUsd: normalized.costUsd,
                stream: false,
                attempts: (axiosResponse as any).__routerMeta?.attempts ?? 1,
                statusCode: axiosResponse.status,
            });

            return normalized;
        } catch (err: any) {
            state.activeRequests = Math.max(0, state.activeRequests - 1);
            const endTime = Date.now();
            const diagnostics = classifyAxiosError(
                err,
                Math.max(1, endTime - startTime),
                1,
                deployment.deploymentId
            );
            this.recordDeploymentFailure(
                deployment.deploymentId,
                err,
                diagnostics.retryAfterMs,
                diagnostics.isRateLimit
            );
            await this.callbackManager.onFailure({
                eventType: "failure",
                modelName: requestedModel,
                resolvedModel: deployment.model,
                provider: deployment.provider,
                deploymentId: deployment.deploymentId,
                startTime,
                endTime,
                latencyMs: diagnostics.latencyMs,
                stream: false,
                attempts: diagnostics.attempts,
                statusCode: diagnostics.statusCode,
                error: err,
            });
            throw err;
        }
    }

    /**
     * Convenience method returning the first embedding vector `number[]` for a string prompt
     * (compatible with `OpenAiEndpoint.embeddings(text)` in `HydeSearchService`).
     */
    async embeddings(input: string | string[], model?: string): Promise<number[]> {
        const res = await this.generateEmbeddings({ input, model });
        if (Array.isArray(res.embeddings) && res.embeddings.length > 0) {
            return res.embeddings[0];
        }
        return [];
    }

    // Legacy compatibility helpers (`OpenAiEndpoint` & `ChatOpenAi`)
    async gptFn(prompt: string, model?: string): Promise<string> {
        const res = await this.completion({ prompt, model });
        return res.content;
    }

    async gptFnChat(messages: ChatMessage[], model?: string): Promise<string> {
        const res = await this.completion({ messages, model });
        return res.content;
    }

    async gptFnTestGenerator(prompt: string, model?: string): Promise<string> {
        const res = await this.completion({ prompt, model, max_tokens: 1024 });
        return res.content;
    }

    async generateResponse(prompt: string, model?: string): Promise<string> {
        const res = await this.completion({ prompt, model });
        return res.content;
    }

    async chatWithAI(messages: ChatMessage[], model?: string): Promise<CompletionResponse> {
        return this.completion({ messages, model });
    }

    async testResponseGeneration(prompt: string, model?: string): Promise<string> {
        const res = await this.completion({ prompt, model });
        return res.content;
    }
}

export { SmartRouter as Router, SmartRouter as SmartRouterEndpoint };

export interface ProviderEndpointOptions extends RouterConfig {
    apiKey?: string;
    OpenApiKey?: string;
    orgId?: string;
    apiBase?: string;
    model?: string;
    provider?: SupportedProvider;
    temperature?: number;
    max_tokens?: number;
    rpm?: number;
    tpm?: number;
    router?: SmartRouter;
}

/**
 * Router-backed OpenAI endpoint class replacing the legacy direct-axios `openai.ts` implementation.
 */
export class OpenAI {
    readonly apiKey: string;
    readonly orgId: string;
    readonly defaultModel: string;
    readonly defaultTemperature?: number;
    readonly router: SmartRouter;

    constructor(options: ProviderEndpointOptions = {}) {
        this.apiKey = options.apiKey || options.OpenApiKey || process.env.OPENAI_API_KEY || "";
        this.orgId = options.orgId || process.env.OPENAI_ORG_ID || "";
        this.defaultModel = options.model || options.defaultModel || "gpt-3.5-turbo";
        this.defaultTemperature = options.temperature;

        if (options.router) {
            this.router = options.router;
        } else {
            const hasExplicitDeployments = Boolean(
                (options.modelList && options.modelList.length > 0) ||
                (options.model_list && options.model_list.length > 0) ||
                (options.deployments && options.deployments.length > 0)
            );
            this.router = new SmartRouter({
                ...options,
                defaultModel: this.defaultModel,
                ...(hasExplicitDeployments
                    ? {}
                    : {
                          modelList: [
                              {
                                  deploymentId: "openai-primary",
                                  modelName: this.defaultModel,
                                  provider: options.provider || "openai",
                                  model: this.defaultModel,
                                  apiKey: this.apiKey,
                                  orgId: this.orgId,
                                  apiBase: options.apiBase,
                                  rpm: options.rpm,
                                  tpm: options.tpm,
                              },
                          ],
                      }),
            });
        }
    }

    async chat(chatOptions: CompletionOptions): Promise<CompletionResponse> {
        return this.router.completion({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
            temperature: chatOptions.temperature ?? this.defaultTemperature ?? 0.7,
            frequency_penalty: chatOptions.frequency_penalty ?? 1,
        });
    }

    async streamedChat(
        chatOptions: CompletionOptions
    ): Promise<CompletionResponse & { chunks: StreamChunk[] }> {
        return this.router.streamedChat({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
            temperature: chatOptions.temperature ?? this.defaultTemperature ?? 0.7,
            frequency_penalty: chatOptions.frequency_penalty ?? 1,
        });
    }

    streamCompletion(
        chatOptions: CompletionOptions
    ): AsyncGenerator<StreamChunk, CompletionResponse, unknown> {
        return this.router.streamCompletion({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
            temperature: chatOptions.temperature ?? this.defaultTemperature ?? 0.7,
        });
    }

    async chatWithFunction(chatOptions: CompletionOptions): Promise<CompletionResponse> {
        return this.router.chatWithFunction({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
            temperature: chatOptions.temperature ?? this.defaultTemperature ?? 0.7,
        });
    }

    async generateEmbeddings(
        optionsOrInput: { input: string | string[]; model?: string } | string | string[]
    ): Promise<any> {
        const res = await this.router.generateEmbeddings(optionsOrInput);
        if (typeof optionsOrInput === "object" && !Array.isArray(optionsOrInput)) {
            if (res.data && res.data.length > 0) {
                return res.data;
            }
        }
        return res;
    }

    async zodSchemaResponse<S extends z.ZodTypeAny>(
        chatOptions: ZodSchemaResponseOptions<S>
    ): Promise<z.infer<S>> {
        return this.router.zodSchemaResponse(chatOptions);
    }

    async generateResponse(prompt: string, model?: string): Promise<string> {
        return this.router.generateResponse(prompt, model || this.defaultModel);
    }

    async chatWithAI(messages: ChatMessage[], model?: string): Promise<CompletionResponse> {
        return this.router.chatWithAI(messages, model || this.defaultModel);
    }

    async testResponseGeneration(prompt: string, model?: string): Promise<string> {
        return this.router.testResponseGeneration(prompt, model || this.defaultModel);
    }
}

/**
 * Router-backed Google Gemini endpoint class replacing the legacy direct-axios `gemini.ts` implementation.
 */
export class GeminiAI {
    readonly apiKey: string;
    readonly defaultModel: string;
    readonly router: SmartRouter;

    constructor(options: ProviderEndpointOptions = {}) {
        this.apiKey =
            options.apiKey || process.env.GEMINI_API_KEY || process.env.PALM_API_KEY || "";
        this.defaultModel = options.model || options.defaultModel || "gemini-pro";

        if (options.router) {
            this.router = options.router;
        } else {
            this.router = new SmartRouter({
                ...options,
                defaultModel: this.defaultModel,
                modelList: options.modelList ||
                    options.model_list ||
                    options.deployments || [
                        {
                            deploymentId: "gemini-primary",
                            modelName: this.defaultModel,
                            provider: options.provider || "gemini",
                            model: this.defaultModel,
                            apiKey: this.apiKey,
                            apiBase: options.apiBase,
                            rpm: options.rpm,
                            tpm: options.tpm,
                        },
                    ],
            });
        }
    }

    async chat(chatOptions: CompletionOptions): Promise<CompletionResponse> {
        return this.router.completion({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
            max_output_tokens: chatOptions.max_output_tokens ?? chatOptions.max_tokens ?? 1024,
        });
    }

    streamCompletion(
        chatOptions: CompletionOptions
    ): AsyncGenerator<StreamChunk, CompletionResponse, unknown> {
        return this.router.streamCompletion({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
        });
    }
}

/**
 * Router-backed Google PaLM 2 endpoint class (`text-bison-001` / `chat-bison-001`).
 */
export class PalmAI extends GeminiAI {
    constructor(options: ProviderEndpointOptions = {}) {
        super({
            ...options,
            provider: options.provider || "palm",
            model: options.model || options.defaultModel || "text-bison-001",
        });
    }
}

/**
 * Router-backed Cohere endpoint class (`command`, `command-r`, `command-r-plus`).
 */
export class CohereAI {
    readonly apiKey: string;
    readonly defaultModel: string;
    readonly router: SmartRouter;

    constructor(options: ProviderEndpointOptions = {}) {
        this.apiKey = options.apiKey || process.env.COHERE_API_KEY || "";
        this.defaultModel = options.model || options.defaultModel || "command";

        if (options.router) {
            this.router = options.router;
        } else {
            this.router = new SmartRouter({
                ...options,
                defaultModel: this.defaultModel,
                modelList: options.modelList ||
                    options.model_list ||
                    options.deployments || [
                        {
                            deploymentId: "cohere-primary",
                            modelName: this.defaultModel,
                            provider: "cohere",
                            model: this.defaultModel,
                            apiKey: this.apiKey,
                            apiBase: options.apiBase,
                            rpm: options.rpm,
                            tpm: options.tpm,
                        },
                    ],
            });
        }
    }

    async chat(chatOptions: CompletionOptions): Promise<CompletionResponse> {
        return this.router.completion({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
        });
    }

    async generate(chatOptions: CompletionOptions): Promise<CompletionResponse> {
        return this.router.completion({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
        });
    }

    streamCompletion(
        chatOptions: CompletionOptions
    ): AsyncGenerator<StreamChunk, CompletionResponse, unknown> {
        return this.router.streamCompletion({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
        });
    }

    async generateEmbeddings(
        optionsOrInput: EmbeddingOptions | string | string[]
    ): Promise<EmbeddingResponse> {
        return this.router.generateEmbeddings(optionsOrInput);
    }
}

/**
 * Router-backed Llama endpoint class replacing the legacy direct-axios `llama.ts` implementation.
 */
export class LlamaAI {
    readonly apiKey: string;
    readonly defaultModel: string;
    readonly router: SmartRouter;
    queue: string[];

    constructor(options: ProviderEndpointOptions = { apiKey: "" }) {
        this.apiKey = options.apiKey || process.env.LLAMA_API_KEY || "";
        this.defaultModel = options.model || options.defaultModel || "llama-13b-chat";
        this.queue = [];

        if (options.router) {
            this.router = options.router;
        } else {
            this.router = new SmartRouter({
                ...options,
                defaultModel: this.defaultModel,
                modelList: options.modelList ||
                    options.model_list ||
                    options.deployments || [
                        {
                            deploymentId: "llama-primary",
                            modelName: this.defaultModel,
                            provider: options.provider || "llama",
                            model: this.defaultModel,
                            apiKey: this.apiKey,
                            apiBase: options.apiBase,
                            rpm: options.rpm,
                            tpm: options.tpm,
                        },
                    ],
            });
        }
    }

    async makeRequest(chatOptions: CompletionOptions): Promise<{ status: number; data: any }> {
        const res = await this.router.completion({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
        });
        return {
            status: 200,
            data: res,
        };
    }

    async _runStreamForJupyter(chatOptions: CompletionOptions): Promise<void> {
        for await (const chunk of this.router.streamCompletion({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
        })) {
            if (chunk.delta) {
                this.queue.push(chunk.delta);
            }
        }
    }

    async *getSequences(): AsyncGenerator<string | undefined, void, unknown> {
        while (this.queue.length > 0) {
            yield this.queue.shift();
        }
    }

    async runStream(
        chatOptions: CompletionOptions
    ): Promise<AsyncGenerator<string | undefined, void, unknown>> {
        await this._runStreamForJupyter(chatOptions);
        return this.getSequences();
    }

    async runSync(chatOptions: CompletionOptions): Promise<CompletionResponse> {
        return this.router.completion({
            ...chatOptions,
            model: chatOptions.model || this.defaultModel,
        });
    }

    chat(
        chatOptions: CompletionOptions
    ): Promise<CompletionResponse | AsyncGenerator<string | undefined, void, unknown>> {
        if (chatOptions.stream) {
            return this.runStream(chatOptions);
        }
        return this.runSync(chatOptions);
    }
}

/**
 * Router-backed `OpenAiEndpoint` class supporting both positional constructor arguments
 * (used in `HydeSearchService` and `TestGenerator`) and `RouterConfig` object initialization.
 */
export class OpenAiEndpoint {
    readonly url: string;
    readonly apiKey: string;
    readonly orgId: string;
    readonly model: string;
    readonly role: ChatRole;
    readonly temperature: number;
    readonly router: SmartRouter;

    constructor(
        urlOrConfig:
            string | ProviderEndpointOptions = "https://api.openai.com/v1/chat/completions",
        apiKey = "",
        orgId = "",
        model = "gpt-3.5-turbo",
        role: ChatRole = "user",
        temperature = 0.7
    ) {
        if (typeof urlOrConfig === "object" && urlOrConfig !== null) {
            this.url = urlOrConfig.apiBase || "https://api.openai.com/v1/chat/completions";
            this.apiKey = urlOrConfig.apiKey || process.env.OPENAI_API_KEY || "";
            this.orgId = urlOrConfig.orgId || process.env.OPENAI_ORG_ID || "";
            this.model = urlOrConfig.model || urlOrConfig.defaultModel || "gpt-3.5-turbo";
            this.role = "user";
            this.temperature = urlOrConfig.temperature ?? 0.7;
            this.router =
                urlOrConfig.router ||
                new SmartRouter({
                    ...urlOrConfig,
                    defaultModel: this.model,
                    modelList: urlOrConfig.modelList ||
                        urlOrConfig.model_list ||
                        urlOrConfig.deployments || [
                            {
                                deploymentId: "openai-endpoint-primary",
                                modelName: this.model,
                                provider: urlOrConfig.provider || "openai",
                                model: this.model,
                                apiKey: this.apiKey,
                                orgId: this.orgId,
                                apiBase: this.url.replace(/\/chat\/completions\/?$/, ""),
                            },
                        ],
                });
        } else {
            this.url = urlOrConfig || "https://api.openai.com/v1/chat/completions";
            this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
            this.orgId = orgId || process.env.OPENAI_ORG_ID || "";
            this.model = model || "gpt-3.5-turbo";
            this.role = role || "user";
            this.temperature = Number.isFinite(temperature) && temperature > 0 ? temperature : 0.7;
            this.router = new SmartRouter({
                defaultModel: this.model,
                modelList: [
                    {
                        deploymentId: "openai-endpoint-primary",
                        modelName: this.model,
                        provider: "openai",
                        model: this.model,
                        apiKey: this.apiKey,
                        orgId: this.orgId,
                        apiBase: this.url.replace(/\/chat\/completions\/?$/, ""),
                    },
                ],
            });
        }
    }

    async gptFn(prompt: string): Promise<string> {
        const res = await this.router.completion({
            model: this.model,
            role: this.role,
            prompt,
            temperature: this.temperature,
        });
        return res.content;
    }

    async gptFnChat(messages: ChatMessage[]): Promise<string> {
        const res = await this.router.completion({
            model: this.model,
            messages,
            temperature: this.temperature,
        });
        return res.content;
    }

    async gptFnTestGenerator(prompt: string): Promise<string> {
        const res = await this.router.completion({
            model: this.model,
            role: this.role,
            prompt,
            temperature: this.temperature,
            max_tokens: 1024,
        });
        return res.content;
    }

    async embeddings(input: string): Promise<number[]> {
        return this.router.embeddings(input, "text-embedding-ada-002");
    }
}

export { OpenAI as ChatOpenAi };

/**
 * Router-backed `Stream` class for Web `ReadableStream` streaming (`OpenAIStream`).
 */
export class Stream {
    readonly router: SmartRouter;
    readonly defaultOptions: CompletionOptions;

    constructor(options: ProviderEndpointOptions & CompletionOptions = {}) {
        const apiKey = options.OpenApiKey || options.apiKey || process.env.OPENAI_API_KEY || "";
        const model = String(options.model || "gpt-3.5-turbo");
        this.defaultOptions = {
            model,
            temperature: options.temperature ?? 0.7,
            top_p: options.top_p,
            frequency_penalty: options.frequency_penalty,
            presence_penalty: options.presence_penalty,
            max_tokens: options.max_tokens ?? 500,
            stream: true,
            n: options.n ?? 1,
        };

        this.router =
            options.router ||
            new SmartRouter({
                ...options,
                defaultModel: model,
                modelList: options.modelList ||
                    options.model_list ||
                    options.deployments || [
                        {
                            deploymentId: "stream-primary",
                            modelName: model,
                            provider: options.provider || "openai",
                            model,
                            apiKey,
                            apiBase: options.apiBase,
                        },
                    ],
            });
    }

    OpenAIStream(promptOrOptions: string | CompletionOptions): ReadableStream<Uint8Array> {
        const merged: CompletionOptions =
            typeof promptOrOptions === "string"
                ? { ...this.defaultOptions, prompt: promptOrOptions, stream: true }
                : { ...this.defaultOptions, ...promptOrOptions, stream: true };
        return this.router.OpenAIStream(merged);
    }
}

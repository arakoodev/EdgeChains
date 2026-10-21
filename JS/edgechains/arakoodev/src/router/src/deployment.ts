import axios, { AxiosError, AxiosInstance } from "axios";
import axiosRetry, { exponentialDelay, isNetworkOrIdempotentRequestError } from "axios-retry";
import {
    getProvider,
    inferProvider,
    LLMProvider,
    ProviderChunk,
    ProviderResult,
} from "./providers.js";
import type {
    CompletionRequest,
    DeploymentConfig,
    DeploymentUsageSnapshot,
    TokenUsage,
} from "./types.js";

const WINDOW_MS = 60_000;

export class Deployment {
    readonly id: string;
    readonly config: DeploymentConfig;
    readonly provider: LLMProvider;
    private client: AxiosInstance;
    private readonly allowedFails: number;
    private readonly cooldownTime: number;

    private windowStart = Date.now();
    private windowRequests = 0;
    private windowTokens = 0;

    private requests = 0;
    private successes = 0;
    private failures = 0;
    private consecutiveFails = 0;
    private cooldownUntil = 0;
    private promptTokens = 0;
    private completionTokens = 0;
    private totalTokens = 0;

    constructor(
        config: DeploymentConfig,
        index: number,
        defaults: {
            timeout: number;
            numRetries: number;
            allowedFails: number;
            cooldownTime: number;
        }
    ) {
        this.config = config;
        this.provider = getProvider(inferProvider(config.litellm_params));
        this.id = `${config.model_name}#${index}`;
        this.allowedFails = defaults.allowedFails;
        this.cooldownTime = defaults.cooldownTime;
        this.client = this.buildClient(defaults.timeout, defaults.numRetries);
    }

    get modelName(): string {
        return this.config.model_name;
    }

    private buildClient(defaultTimeout: number, defaultRetries: number): AxiosInstance {
        const client = axios.create({
            timeout: this.config.timeout ?? defaultTimeout,
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 300,
        });
        // Reliability via axios interceptors (per the issue): retries with
        // exponential backoff for network errors, timeouts, 429 and 5xx.
        axiosRetry(client, {
            retries: this.config.max_retries ?? defaultRetries,
            retryDelay: exponentialDelay,
            shouldResetTimeout: true,
            retryCondition: (error: AxiosError) => {
                if (isNetworkOrIdempotentRequestError(error)) return true;
                if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return true;
                const status = error.response?.status;
                return status === 429 || (status !== undefined && status >= 500);
            },
        });
        return client;
    }

    private refreshWindow(): void {
        if (Date.now() - this.windowStart >= WINDOW_MS) {
            this.windowStart = Date.now();
            this.windowRequests = 0;
            this.windowTokens = 0;
        }
    }

    /** True when the deployment is not in a failure cooldown. */
    isHealthy(): boolean {
        return Date.now() >= this.cooldownUntil;
    }

    /** True when the deployment is below its rpm/tpm limits for this minute. */
    isUnderRateLimit(): boolean {
        this.refreshWindow();
        if (this.config.rpm !== undefined && this.windowRequests >= this.config.rpm) return false;
        if (this.config.tpm !== undefined && this.windowTokens >= this.config.tpm) return false;
        return true;
    }

    /** Tokens used in the current window — the least-tokens routing score. */
    get currentTokens(): number {
        this.refreshWindow();
        return this.windowTokens;
    }

    /** Requests served in the current window — the least-busy routing score. */
    get currentRequests(): number {
        this.refreshWindow();
        return this.windowRequests;
    }

    get cumulativeTokens(): number {
        return this.totalTokens;
    }

    recordRequest(): void {
        this.refreshWindow();
        this.windowRequests += 1;
        this.requests += 1;
    }

    recordSuccess(usage?: TokenUsage): void {
        this.refreshWindow();
        this.successes += 1;
        this.consecutiveFails = 0;
        if (usage) {
            this.windowTokens += usage.total_tokens;
            this.promptTokens += usage.prompt_tokens;
            this.completionTokens += usage.completion_tokens;
            this.totalTokens += usage.total_tokens;
        }
    }

    recordFailure(): void {
        this.failures += 1;
        this.consecutiveFails += 1;
        if (this.consecutiveFails > this.allowedFails) {
            this.cooldownUntil = Date.now() + this.cooldownTime;
        }
    }

    async complete(request: CompletionRequest): Promise<ProviderResult> {
        return this.provider.complete(this.client, this.config.litellm_params, request);
    }

    stream(request: CompletionRequest): AsyncIterable<ProviderChunk> {
        return this.provider.stream(this.client, this.config.litellm_params, request);
    }

    snapshot(): DeploymentUsageSnapshot {
        this.refreshWindow();
        return {
            id: this.id,
            model_name: this.config.model_name,
            provider: this.provider.name,
            model: this.config.litellm_params.model,
            requests: this.requests,
            successes: this.successes,
            failures: this.failures,
            consecutive_fails: this.consecutiveFails,
            prompt_tokens: this.promptTokens,
            completion_tokens: this.completionTokens,
            total_tokens: this.totalTokens,
            current_rpm: this.windowRequests,
            current_tpm: this.windowTokens,
            cooling_down: !this.isHealthy(),
        };
    }
}

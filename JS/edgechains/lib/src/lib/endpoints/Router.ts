import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { BaseEndpoint, BaseEndpointConfig } from './BaseEndpoint.js';

export type Provider = 'openai' | 'google' | 'cohere' | 'palm';

export interface DeploymentConfig {
    id?: string;
    modelName: string;
    provider: Provider;
    apiKey: string;
    baseUrl?: string;
    tpmLimit?: number;
    rpmLimit?: number;
    timeout?: number;
    maxRetries?: number;
}

export interface DeploymentState {
    config: DeploymentConfig;
    totalTokens: number;
    requestsThisMinute: number;
    tokensThisMinute: number;
    windowStart: number;
    cooldownUntil: number;
}

export interface CompletionOptions {
    model: string;
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface CompletionResult {
    content: string;
    model: string;
    provider: Provider;
    deploymentId: string;
    usage: TokenUsage;
    latencyMs: number;
}

export interface ObservabilityCallbacks {
    onSuccess?: (event: {
        model: string;
        provider: Provider;
        deploymentId: string;
        usage: TokenUsage;
        latencyMs: number;
    }) => void;
    onFailure?: (event: {
        model: string;
        provider: Provider;
        deploymentId: string;
        error: Error;
        latencyMs: number;
    }) => void;
}

export class Router extends BaseEndpoint {
    private deployments: Map<string, DeploymentState[]> = new Map();
    private callbacks: ObservabilityCallbacks = {};

    constructor(deployments: DeploymentConfig[] = [], config: BaseEndpointConfig = {}, callbacks: ObservabilityCallbacks = {}) {
        super(config);
        this.callbacks = callbacks;
        for (const dep of deployments) {
            this.addDeployment(dep);
        }
    }

    public addDeployment(config: DeploymentConfig): void {
        const id = config.id || `${config.provider}-${config.modelName}-${Math.random().toString(36).slice(2, 7)}`;
        const state: DeploymentState = {
            config: { ...config, id },
            totalTokens: 0,
            requestsThisMinute: 0,
            tokensThisMinute: 0,
            windowStart: Date.now(),
            cooldownUntil: 0,
        };

        const list = this.deployments.get(config.modelName) || [];
        list.push(state);
        this.deployments.set(config.modelName, list);
    }

    public getDeployments(modelName?: string): DeploymentState[] {
        if (modelName) {
            return this.deployments.get(modelName) || [];
        }
        const all: DeploymentState[] = [];
        for (const states of this.deployments.values()) {
            all.push(...states);
        }
        return all;
    }

    public setCallbacks(callbacks: ObservabilityCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    protected setupInterceptors(): void {
        this.client.interceptors.response.use(
            (response: AxiosResponse) => response,
            async (error: any) => {
                const config = error.config;
                if (!config || !config._retryCount) {
                    if (config) config._retryCount = 0;
                }

                const maxRetries = config?._maxRetries ?? 2;
                const status = error.response ? error.response.status : null;
                const isRetryable = status === 429 || (status !== null && status >= 500) || error.code === 'ECONNABORTED';

                if (isRetryable && config && config._retryCount < maxRetries) {
                    config._retryCount += 1;
                    const delay = Math.pow(2, config._retryCount) * 100;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    return this.client(config);
                }
                return Promise.reject(error);
            }
        );
    }

    public selectDeployment(modelName: string): DeploymentState {
        const list = this.deployments.get(modelName);
        if (!list || list.length === 0) {
            throw new Error(`No deployments configured for model: ${modelName}`);
        }

        const now = Date.now();
        // Reset minute windows if 60s has passed
        for (const dep of list) {
            if (now - dep.windowStart > 60000) {
                dep.requestsThisMinute = 0;
                dep.tokensThisMinute = 0;
                dep.windowStart = now;
            }
        }

        // Filter deployments that are not cooling down and below RPM/TPM limits
        const available = list.filter((dep) => {
            const isCoolingDown = now < dep.cooldownUntil;
            const rpmExceeded = dep.config.rpmLimit ? dep.requestsThisMinute >= dep.config.rpmLimit : false;
            const tpmExceeded = dep.config.tpmLimit ? dep.tokensThisMinute >= dep.config.tpmLimit : false;
            return !isCoolingDown && !rpmExceeded && !tpmExceeded;
        });

        // Strategy: least tokens used
        if (available.length > 0) {
            available.sort((a, b) => a.totalTokens - b.totalTokens);
            return available[0];
        }

        // Fallback: deployment exiting cooldown soonest
        const sortedByCooldown = [...list].sort((a, b) => a.cooldownUntil - b.cooldownUntil);
        return sortedByCooldown[0];
    }

    public async completion(options: CompletionOptions): Promise<CompletionResult> {
        const list = this.deployments.get(options.model);
        if (!list || list.length === 0) {
            throw new Error(`No deployments configured for model: ${options.model}`);
        }

        // Attempt up to all available deployments
        const tried = new Set<string>();
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < list.length; attempt++) {
            const candidate = this.selectDeploymentForAttempt(options.model, tried);
            if (!candidate) break;
            tried.add(candidate.config.id!);

            const startTime = Date.now();
            try {
                const result = await this.executeDeploymentCall(candidate, options);
                const latencyMs = Date.now() - startTime;

                // Update usage stats
                candidate.totalTokens += result.usage.totalTokens;
                candidate.tokensThisMinute += result.usage.totalTokens;
                candidate.requestsThisMinute += 1;

                if (this.callbacks.onSuccess) {
                    this.callbacks.onSuccess({
                        model: options.model,
                        provider: candidate.config.provider,
                        deploymentId: candidate.config.id!,
                        usage: result.usage,
                        latencyMs,
                    });
                }

                return {
                    content: result.content,
                    model: options.model,
                    provider: candidate.config.provider,
                    deploymentId: candidate.config.id!,
                    usage: result.usage,
                    latencyMs,
                };
            } catch (err: any) {
                const latencyMs = Date.now() - startTime;
                lastError = err;

                // If 429 rate limit, set cooldown on this deployment
                if (err.response && err.response.status === 429) {
                    const retryAfter = parseInt(err.response.headers?.['retry-after'] || '10', 10);
                    candidate.cooldownUntil = Date.now() + retryAfter * 1000;
                }

                if (this.callbacks.onFailure) {
                    this.callbacks.onFailure({
                        model: options.model,
                        provider: candidate.config.provider,
                        deploymentId: candidate.config.id!,
                        error: err,
                        latencyMs,
                    });
                }
                // Continue to next available deployment fallback
            }
        }

        throw lastError || new Error(`All deployments failed for model: ${options.model}`);
    }

    public async *streamCompletion(options: CompletionOptions): AsyncGenerator<{ chunk: string; done: boolean; totalTokens?: number }> {
        const candidate = this.selectDeployment(options.model);
        const url = this.getProviderUrl(candidate.config);
        const headers = this.getProviderHeaders(candidate.config);
        const payload = this.formatProviderPayload(candidate.config, { ...options, stream: true });

        const response = await this.client({
            method: 'POST',
            url,
            headers,
            data: payload,
            responseType: 'stream',
            timeout: candidate.config.timeout || this.config.timeout || 30000,
        });

        let accumulatedContent = '';
        const stream = response.data;

        for await (const chunk of stream) {
            const text = chunk.toString();
            accumulatedContent += text;
            yield { chunk: text, done: false };
        }

        const estimatedTokens = Math.ceil(accumulatedContent.length / 4);
        candidate.totalTokens += estimatedTokens;
        yield { chunk: '', done: true, totalTokens: estimatedTokens };
    }

    private selectDeploymentForAttempt(modelName: string, tried: Set<string>): DeploymentState | null {
        const list = (this.deployments.get(modelName) || []).filter((d) => !tried.has(d.config.id!));
        if (list.length === 0) return null;

        const now = Date.now();
        const available = list.filter((d) => now >= d.cooldownUntil);
        const candidates = available.length > 0 ? available : list;
        candidates.sort((a, b) => a.totalTokens - b.totalTokens);
        return candidates[0];
    }

    private async executeDeploymentCall(deployment: DeploymentState, options: CompletionOptions): Promise<{ content: string; usage: TokenUsage }> {
        const url = this.getProviderUrl(deployment.config);
        const headers = this.getProviderHeaders(deployment.config);
        const payload = this.formatProviderPayload(deployment.config, options);

        const response = await this.client({
            method: 'POST',
            url,
            headers,
            data: payload,
            timeout: deployment.config.timeout || this.config.timeout || 30000,
            _maxRetries: deployment.config.maxRetries ?? 2,
        } as any);

        return this.parseProviderResponse(deployment.config.provider, response.data);
    }

    private getProviderUrl(config: DeploymentConfig): string {
        if (config.baseUrl) return config.baseUrl;
        switch (config.provider) {
            case 'openai':
                return 'https://api.openai.com/v1/chat/completions';
            case 'google':
            case 'palm':
                return `https://generativelanguage.googleapis.com/v1beta/models/${config.modelName}:generateContent?key=${config.apiKey}`;
            case 'cohere':
                return 'https://api.cohere.ai/v1/chat';
            default:
                throw new Error(`Unsupported provider: ${config.provider}`);
        }
    }

    private getProviderHeaders(config: DeploymentConfig): Record<string, string> {
        switch (config.provider) {
            case 'openai':
                return { Authorization: `Bearer ${config.apiKey}` };
            case 'cohere':
                return { Authorization: `Bearer ${config.apiKey}` };
            case 'google':
            case 'palm':
                return {};
            default:
                return {};
        }
    }

    private formatProviderPayload(config: DeploymentConfig, options: CompletionOptions): any {
        const messages = options.messages || [{ role: 'user', content: options.prompt || '' }];
        switch (config.provider) {
            case 'openai':
                return {
                    model: options.model,
                    messages,
                    max_tokens: options.max_tokens || 256,
                    temperature: options.temperature ?? 0.7,
                    stream: options.stream || false,
                };
            case 'cohere':
                return {
                    model: options.model,
                    message: messages[messages.length - 1]?.content || '',
                    temperature: options.temperature ?? 0.7,
                    stream: options.stream || false,
                };
            case 'google':
            case 'palm':
                return {
                    contents: messages.map((m) => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }],
                    })),
                };
            default:
                return options;
        }
    }

    private parseProviderResponse(provider: Provider, data: any): { content: string; usage: TokenUsage } {
        switch (provider) {
            case 'openai': {
                const content = data.choices?.[0]?.message?.content || '';
                const promptTokens = data.usage?.prompt_tokens || Math.ceil(content.length / 4);
                const completionTokens = data.usage?.completion_tokens || Math.ceil(content.length / 4);
                const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens;
                return { content, usage: { promptTokens, completionTokens, totalTokens } };
            }
            case 'cohere': {
                const content = data.text || '';
                const promptTokens = data.meta?.tokens?.input_tokens || Math.ceil(content.length / 4);
                const completionTokens = data.meta?.tokens?.output_tokens || Math.ceil(content.length / 4);
                const totalTokens = promptTokens + completionTokens;
                return { content, usage: { promptTokens, completionTokens, totalTokens } };
            }
            case 'google':
            case 'palm': {
                const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const promptTokens = data.usageMetadata?.promptTokenCount || Math.ceil(content.length / 4);
                const completionTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4);
                const totalTokens = data.usageMetadata?.totalTokenCount || promptTokens + completionTokens;
                return { content, usage: { promptTokens, completionTokens, totalTokens } };
            }
            default: {
                const text = typeof data === 'string' ? data : JSON.stringify(data);
                const tokens = Math.ceil(text.length / 4);
                return { content: text, usage: { promptTokens: tokens, completionTokens: tokens, totalTokens: tokens * 2 } };
            }
        }
    }

    public static fromJsonnet(config: { deployments: DeploymentConfig[]; callbacks?: ObservabilityCallbacks }): Router {
        return new Router(config.deployments, {}, config.callbacks);
    }
}

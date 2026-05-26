import axios from 'axios';
import { RouterConfig, ChatRequest, ChatResponse, StreamChunk, ModelDeployment, ProviderType } from './types';
import { UsageTracker } from './usage-tracker';
import { LoggingManager } from './logging';
import { createProvider, OpenAIProvider, GeminiProvider, CohereProvider } from './providers';

type ProviderInstance = OpenAIProvider | GeminiProvider | CohereProvider;

export class SmartRouter {
    private config: RouterConfig;
    private usageTracker: UsageTracker;
    public logging: LoggingManager;
    private providers: ProviderInstance[];
    private roundRobinIndex: number = 0;

    constructor(config: RouterConfig) {
        this.config = config;
        this.usageTracker = new UsageTracker();
        this.logging = new LoggingManager();
        this.providers = config.deployments.map(d =>
            createProvider(d.provider, d.apiKey, d.baseUrl, d.orgId)
        );
        this._setupAxiosInterceptors();
    }

    static fromConfig(config: RouterConfig): SmartRouter {
        return new SmartRouter(config);
    }

    private _setupAxiosInterceptors(): void {
        axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.code === 'ECONNABORTED') {
                    return Promise.reject(new Error('timeout'));
                }
                if (error.response?.status === 429) {
                    return Promise.reject(new Error('rate_limited'));
                }
                if (error.response?.status && error.response.status >= 500) {
                    return Promise.reject(new Error('server_error'));
                }
                return Promise.reject(error);
            }
        );
    }

    private _getEligibleDeployments(providerFilter?: ProviderType): number[] {
        const eligible: number[] = [];
        for (let i = 0; i < this.config.deployments.length; i++) {
            const dep = this.config.deployments[i];
            if (providerFilter && dep.provider !== providerFilter) continue;
            if (this.usageTracker.canUse(i, dep.rpmLimit, dep.tpmLimit)) {
                eligible.push(i);
            }
        }
        return eligible;
    }

    private _selectDeployment(eligible: number[]): number {
        if (eligible.length === 0) return -1;
        if (eligible.length === 1) return eligible[0];

        switch (this.config.strategy) {
            case 'least-tokens':
                return this.usageTracker.getLeastUsedIndex(eligible);
            case 'round-robin':
                const idx = this.roundRobinIndex % eligible.length;
                this.roundRobinIndex++;
                return eligible[idx];
            case 'fallback':
            default:
                return eligible[0];
        }
    }

    private _getProviderInstance(index: number): ProviderInstance {
        return this.providers[index];
    }

    private _getDeploymentConfig(index: number): ModelDeployment {
        return this.config.deployments[index];
    }

    async chat(request: ChatRequest): Promise<ChatResponse> {
        const eligible = this._getEligibleDeployments(request.provider);
        const depIndex = this._selectDeployment(eligible);

        if (depIndex === -1) {
            this.logging.log({ type: 'error', error: 'no available deployments', metadata: { eligible: eligible.length } });
            throw new Error('No available deployments for request');
        }

        const dep = this._getDeploymentConfig(depIndex);
        const provider = this._getProviderInstance(depIndex);
        const start = Date.now();

        this.logging.log({
            type: 'deployment_selected',
            provider: dep.provider,
            model: dep.model,
            deploymentIndex: depIndex,
        });

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result = await provider.chat(request, dep.model);
                const duration = Date.now() - start;

                this.usageTracker.recordUsage(
                    depIndex,
                    result.usage.promptTokens,
                    result.usage.completionTokens
                );

                this.logging.log({
                    type: 'completion',
                    provider: dep.provider,
                    model: result.model,
                    deploymentIndex: depIndex,
                    durationMs: duration,
                    usage: result.usage,
                });

                return {
                    content: result.content,
                    provider: dep.provider,
                    model: result.model,
                    usage: result.usage,
                };
            } catch (e) {
                lastError = e instanceof Error ? e : new Error(String(e));
                this.usageTracker.recordFailure(depIndex);

                this.logging.log({
                    type: 'error',
                    provider: dep.provider,
                    model: dep.model,
                    deploymentIndex: depIndex,
                    error: lastError.message,
                    metadata: { attempt: attempt + 1, willRetry: attempt < 2 },
                });

                if (attempt < 2) {
                    this.logging.log({
                        type: 'retry',
                        provider: dep.provider,
                        model: dep.model,
                        deploymentIndex: depIndex,
                        metadata: { attempt: attempt + 1 },
                    });
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));

                    const failoverEligible = this._getEligibleDeployments(request.provider)
                        .filter(i => i !== depIndex);
                    if (failoverEligible.length > 0) {
                        const failoverIdx = this._selectDeployment(failoverEligible);
                        if (failoverIdx >= 0) {
                            const failoverDep = this._getDeploymentConfig(failoverIdx);
                            const failoverProvider = this._getProviderInstance(failoverIdx);
                            this.logging.log({
                                type: 'deployment_selected',
                                provider: failoverDep.provider,
                                model: failoverDep.model,
                                deploymentIndex: failoverIdx,
                                metadata: { failover: true, fromIndex: depIndex },
                            });
                            try {
                                const result = await failoverProvider.chat(request, failoverDep.model);
                                const duration = Date.now() - start;
                                this.usageTracker.recordUsage(
                                    failoverIdx,
                                    result.usage.promptTokens,
                                    result.usage.completionTokens
                                );
                                this.logging.log({
                                    type: 'completion',
                                    provider: failoverDep.provider,
                                    model: result.model,
                                    deploymentIndex: failoverIdx,
                                    durationMs: duration,
                                    usage: result.usage,
                                });
                                return {
                                    content: result.content,
                                    provider: failoverDep.provider,
                                    model: result.model,
                                    usage: result.usage,
                                };
                            } catch (failoverError) {
                                lastError = failoverError instanceof Error ? failoverError : new Error(String(failoverError));
                                this.usageTracker.recordFailure(failoverIdx);
                            }
                        }
                    }
                }
            }
        }

        throw lastError || new Error('All deployments failed');
    }

    async *streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
        const eligible = this._getEligibleDeployments(request.provider);
        const depIndex = this._selectDeployment(eligible);

        if (depIndex === -1) {
            this.logging.log({ type: 'error', error: 'no available deployments for stream' });
            throw new Error('No available deployments for streaming request');
        }

        const dep = this._getDeploymentConfig(depIndex);
        const provider = this._getProviderInstance(depIndex);
        const start = Date.now();
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;

        this.logging.log({
            type: 'stream_start',
            provider: dep.provider,
            model: dep.model,
            deploymentIndex: depIndex,
        });

        const streamRequest = { ...request, stream: true };

        const providerObj = provider as any;

        if (typeof providerObj.streamChat !== 'function') {
            const result = await providerObj.chat(request, dep.model);
            yield {
                content: result.content,
                finishReason: 'stop',
                usage: result.usage,
                provider: dep.provider,
                model: result.model,
            };
            return;
        }

        let streamError: Error | null = null;
        let streamDone = false;

        await new Promise<void>((resolve, reject) => {
            providerObj.streamChat(streamRequest, dep.model, {
                onChunk: (chunk: StreamChunk) => {
                    if (chunk.provider) {
                        chunk.provider = chunk.provider;
                    }
                    if (chunk.content) {
                        totalCompletionTokens += chunk.content.split(/s+/).filter(Boolean).length;
                    }
                    this.logging.log({
                        type: 'stream_chunk',
                        provider: dep.provider,
                        model: dep.model,
                        metadata: { chunkLength: chunk.content.length },
                    });
                },
                onDone: (usage?: any) => {
                    streamDone = true;
                    const finalUsage = usage || {
                        promptTokens: totalPromptTokens,
                        completionTokens: totalCompletionTokens,
                        totalTokens: totalPromptTokens + totalCompletionTokens,
                    };
                    this.usageTracker.recordUsage(depIndex, finalUsage.promptTokens, finalUsage.completionTokens);
                    this.logging.log({
                        type: 'stream_end',
                        provider: dep.provider,
                        model: dep.model,
                        deploymentIndex: depIndex,
                        durationMs: Date.now() - start,
                        usage: finalUsage,
                    });
                    resolve();
                },
                onError: (e: Error) => {
                    streamError = e;
                    this.usageTracker.recordFailure(depIndex);
                    this.logging.log({
                        type: 'error',
                        provider: dep.provider,
                        model: dep.model,
                        deploymentIndex: depIndex,
                        error: e.message,
                    });
                    reject(e);
                },
            });
        });

        if (streamError) throw streamError;
    }

    addCallback(callback: (event: any) => void): void {
        this.logging.addCallback(callback);
    }

    getUsageStats(): Map<number, import('./types').DeploymentStats> {
        return this.usageTracker['stats'];
    }

    resetUsage(): void {
        this.usageTracker.reset();
    }
}

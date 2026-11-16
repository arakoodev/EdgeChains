/**
 * MockAI Interceptor & Provider Simulator for EdgeChains SmartRouter (Issue #286)
 * Inspired by polly3d/mockai — intercepts axios requests to OpenAI, Google PaLM, and Cohere
 * endpoints for deterministic offline unit testing of load balancing, retries, streaming & usage.
 */
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export interface MockEndpointBehavior {
    status?: number;
    failTimes?: number;
    latencyMs?: number;
    responseContent?: string;
    promptTokens?: number;
    completionTokens?: number;
    streamChunks?: string[];
}

export class MockAI {
    private behaviors: Map<string, MockEndpointBehavior> = new Map();
    private callCounts: Map<string, number> = new Map();

    public registerEndpoint(urlPattern: string, behavior: MockEndpointBehavior): void {
        this.behaviors.set(urlPattern, { ...behavior });
        this.callCounts.set(urlPattern, 0);
    }

    public getCallCount(urlPattern: string): number {
        return this.callCounts.get(urlPattern) || 0;
    }

    public createMockAxiosInstance(): AxiosInstance {
        const responseFulfilledHandlers: Array<(res: AxiosResponse) => any> = [];
        const responseRejectedHandlers: Array<(err: any) => any> = [];

        const instance: any = {
            interceptors: {
                response: {
                    use: (
                        onFulfilled?: (res: AxiosResponse) => any,
                        onRejected?: (err: any) => any
                    ) => {
                        if (onFulfilled) responseFulfilledHandlers.push(onFulfilled);
                        if (onRejected) responseRejectedHandlers.push(onRejected);
                        return responseFulfilledHandlers.length - 1;
                    },
                },
            },
            request: async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
                try {
                    let res = await this.dispatchRequest(config);
                    for (const fn of responseFulfilledHandlers) {
                        res = await fn(res);
                    }
                    return res;
                } catch (err) {
                    let currentErr = err;
                    for (const errFn of responseRejectedHandlers) {
                        try {
                            return await errFn(currentErr);
                        } catch (nextErr) {
                            currentErr = nextErr;
                        }
                    }
                    throw currentErr;
                }
            },
            post: async (url: string, data?: any, config?: AxiosRequestConfig) => {
                return instance.request({ ...config, method: "POST", url, data });
            },
        };

        return instance as AxiosInstance;
    }

    private async dispatchRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
        const url = config.url || "";
        let matchedKey = "";
        for (const pattern of this.behaviors.keys()) {
            if (url.includes(pattern)) {
                matchedKey = pattern;
                break;
            }
        }

        const behavior: MockEndpointBehavior = matchedKey
            ? this.behaviors.get(matchedKey)!
            : { responseContent: "Default mock reply", promptTokens: 8, completionTokens: 6 };

        if (matchedKey) {
            this.callCounts.set(matchedKey, (this.callCounts.get(matchedKey) || 0) + 1);
        }

        if (behavior.latencyMs && behavior.latencyMs > 0) {
            await new Promise((r) => setTimeout(r, behavior.latencyMs));
        }

        if (behavior.failTimes && behavior.failTimes > 0) {
            behavior.failTimes -= 1;
            const error: any = new Error(`Mock HTTP Error ${behavior.status || 429}`);
            error.config = config;
            error.response = {
                status: behavior.status || 429,
                data: { error: "Rate limit or transient server failure" },
            };
            throw error;
        }

        const content = behavior.responseContent ?? "Mocked AI completion response";
        const promptTokens = behavior.promptTokens ?? 10;
        const completionTokens = behavior.completionTokens ?? 15;
        const totalTokens = promptTokens + completionTokens;

        let data: any;
        if (url.includes("generativelanguage.googleapis.com") || url.includes("palm")) {
            data = {
                candidates: [{ content, author: "1" }],
                usageMetadata: {
                    promptTokenCount: promptTokens,
                    candidatesTokenCount: completionTokens,
                    totalTokenCount: totalTokens,
                },
                chunks: behavior.streamChunks,
            };
        } else if (url.includes("cohere")) {
            data = {
                text: content,
                meta: {
                    billed_units: {
                        input_tokens: promptTokens,
                        output_tokens: completionTokens,
                    },
                },
                chunks: behavior.streamChunks,
            };
        } else {
            data = {
                id: "chatcmpl-mock-edgechains",
                choices: [
                    {
                        index: 0,
                        message: { role: "assistant", content },
                    },
                ],
                usage: {
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: totalTokens,
                },
                chunks: behavior.streamChunks,
            };
        }

        return {
            data,
            status: 200,
            statusText: "OK",
            headers: {},
            config: config as any,
        };
    }
}

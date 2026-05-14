import axios, { AxiosInstance, AxiosResponse } from "axios";
import { retry } from "@lifeomic/attempt";
import { role } from "../../types/index";
import { Readable } from "stream";

export interface DeploymentConfig {
    id: string;
    provider: "openai" | "google" | "cohere" | "openrouter";
    model: string;
    apiKey: string;
    url?: string;
    weight?: number;
    priority?: number;
}

export interface RouterOptions {
    deployments: DeploymentConfig[];
    strategy?: "least-tokens" | "round-robin" | "priority";
    timeout?: number;
    retries?: number;
    sentryDsn?: string;
    posthogKey?: string;
    posthogHost?: string;
}

export interface ChatMessage {
    role: role;
    content: string;
}

export interface ChatOptions {
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface SmartRouterResponse {
    content: string;
    usage: Usage;
    model: string;
    provider: string;
}

export class SmartRouter {
    private deployments: DeploymentConfig[];
    private strategy: string;
    private timeout: number;
    private retries: number;
    private axiosInstance: AxiosInstance;
    private tokenUsageMap: Map<string, number> = new Map();
    private sentryDsn?: string;
    private posthogKey?: string;

    constructor(options: RouterOptions) {
        this.deployments = options.deployments;
        this.strategy = options.strategy || "least-tokens";
        this.timeout = options.timeout || 30000;
        this.retries = options.retries || 3;
        this.sentryDsn = options.sentryDsn;
        this.posthogKey = options.posthogKey;

        this.axiosInstance = axios.create({
            timeout: this.timeout,
        });

        this.axiosInstance.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 429) {
                    console.warn("Rate limit hit, triggering retry/failover...");
                }
                return Promise.reject(error);
            }
        );

        this.deployments.forEach(d => this.tokenUsageMap.set(d.id, 0));
    }

    private selectDeployment(): DeploymentConfig {
        if (this.strategy === "least-tokens") {
            return this.deployments.reduce((prev, curr) => {
                const prevUsage = this.tokenUsageMap.get(prev.id) || 0;
                const currUsage = this.tokenUsageMap.get(curr.id) || 0;
                return prevUsage <= currUsage ? prev : curr;
            });
        }
        if (this.strategy === "round-robin") {
            const deploymentsByUsage = [...this.deployments].sort((a, b) => {
                const usageA = this.tokenUsageMap.get(a.id) || 0;
                const usageB = this.tokenUsageMap.get(b.id) || 0;
                return usageA - usageB;
            });
            const lowestUsage = this.tokenUsageMap.get(deploymentsByUsage[0].id) || 0;
            const candidates = deploymentsByUsage.filter(d => (this.tokenUsageMap.get(d.id) || 0) === lowestUsage);
            return candidates[Math.floor(Math.random() * candidates.length)];
        }
        if (this.strategy === "priority") {
            return this.deployments.reduce((prev, curr) => {
                const prevPriority = prev.priority ?? 999;
                const currPriority = curr.priority ?? 999;
                return prevPriority <= currPriority ? prev : curr;
            });
        }
        return this.deployments[0];
    }

    async chat(options: ChatOptions): Promise<SmartRouterResponse | Readable> {
        if (options.stream) {
            const deployment = this.selectDeployment();
            this.logToObservability(deployment, options, "stream_started");
            return this.callProviderStream(deployment, options);
        }

        return await retry(
            async () => {
                const deployment = this.selectDeployment();
                const response = await this.callProvider(deployment, options);
                
                const usage = this.normalizeUsage(deployment, response.data);
                const currentTotal = this.tokenUsageMap.get(deployment.id) || 0;
                this.tokenUsageMap.set(deployment.id, currentTotal + usage.total_tokens);

                this.logToObservability(deployment, options, "success", usage);

                return {
                    content: this.extractContent(deployment, response),
                    usage: usage,
                    model: deployment.model,
                    provider: deployment.provider,
                };
            },
            {
                maxAttempts: this.retries,
                handleError: (error, context) => {
                    console.error(`Retry attempt ${context.attemptNum} failed: ${error.response?.data?.error?.message || error.message}`);
                }
            }
        );
    }

    private async callProvider(deployment: DeploymentConfig, options: ChatOptions): Promise<AxiosResponse> {
        const { url, body, headers } = this.prepareRequest(deployment, options);
        return await this.axiosInstance.post(url, body, { headers });
    }

    private async callProviderStream(deployment: DeploymentConfig, options: ChatOptions): Promise<Readable> {
        const { url, body, headers } = this.prepareRequest(deployment, options);
        const response = await this.axiosInstance.post(url, body, { 
            headers, 
            responseType: "stream" 
        });
        return response.data;
    }

    private prepareRequest(deployment: DeploymentConfig, options: ChatOptions) {
        let url = deployment.url;
        let body: any = {
            model: deployment.model,
            temperature: options.temperature || 0.7,
            max_tokens: options.max_tokens || 512,
            stream: options.stream || false,
        };
        let headers: any = { "Content-Type": "application/json" };

        if (deployment.provider === "openai" || deployment.provider === "openrouter") {
            url = url || (deployment.provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions");
            headers["Authorization"] = `Bearer ${deployment.apiKey}`;
            if (deployment.provider === "openrouter") {
                headers["HTTP-Referer"] = "https://github.com/arakoodev/EdgeChains";
                headers["X-Title"] = "EdgeChains Smart Router";
            }
            body.messages = options.messages;
        } else if (deployment.provider === "google") {
            url = url || `https://generativelanguage.googleapis.com/v1/models/${deployment.model}:generateContent?key=${deployment.apiKey}`;
            body = {
                contents: options.messages.map(m => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }]
                })),
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    maxOutputTokens: options.max_tokens || 512,
                }
            };
        } else if (deployment.provider === "cohere") {
            url = url || "https://api.cohere.ai/v1/chat";
            headers["Authorization"] = `Bearer ${deployment.apiKey}`;
            body = {
                message: options.messages[options.messages.length - 1].content,
                model: deployment.model,
                chat_history: options.messages.slice(0, -1).map(m => ({
                    role: m.role.toUpperCase(),
                    message: m.content
                }))
            };
        }

        return { url: url!, body, headers };
    }

    private extractContent(deployment: DeploymentConfig, response: AxiosResponse): string {
        if (deployment.provider === "openai" || deployment.provider === "openrouter") return response.data.choices[0].message.content;
        if (deployment.provider === "google") return response.data.candidates[0].content.parts[0].text;
        if (deployment.provider === "cohere") return response.data.text;
        return "";
    }

    private normalizeUsage(deployment: DeploymentConfig, data: any): Usage {
        if (deployment.provider === "openai" || deployment.provider === "openrouter") return data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        if (deployment.provider === "google") {
            const m = data.usageMetadata;
            return m ? { prompt_tokens: m.promptTokenCount, completion_tokens: m.candidatesTokenCount, total_tokens: m.totalTokenCount } : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        }
        if (deployment.provider === "cohere") {
            const t = data.token_count;
            return t ? { prompt_tokens: t.prompt_tokens, completion_tokens: t.response_tokens, total_tokens: t.total_tokens } : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        }
        return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    }

    private logToObservability(deployment: DeploymentConfig, options: ChatOptions, status: string, usage?: Usage) {
        if (this.sentryDsn) { /* ... */ }
        if (this.posthogKey) { /* ... */ }
    }
}

import axios, { AxiosInstance, AxiosResponse } from "axios";
import { retry } from "@lifeomic/attempt";
import { role } from "../../types/index";

export interface DeploymentConfig {
    id: string;
    provider: "openai" | "google" | "cohere" | "openrouter";
    model: string;
    apiKey: string;
    url?: string;
    weight?: number;
    priority?: number;
    rpm?: number;
    tpm?: number;
}

export interface RouterOptions {
    deployments: DeploymentConfig[];
    strategy?: "least-tokens" | "round-robin" | "priority";
    timeout?: number;
    retries?: number;
    sentryDsn?: string;
    posthogKey?: string;
    posthogHost?: string;
    cooldownPeriod?: number; // ms
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
    deploymentId: string;
}

export interface ObservabilityAdapter {
    onSuccess: (deployment: DeploymentConfig, options: ChatOptions, usage: Usage, latency: number) => void;
    onFailure: (deployment: DeploymentConfig, options: ChatOptions, error: any) => void;
}

export class SmartRouter {
    private deployments: DeploymentConfig[];
    private strategy: string;
    private timeout: number;
    private retries: number;
    private cooldownPeriod: number;
    private axiosInstance: AxiosInstance;
    
    private tokenUsageMap: Map<string, number> = new Map();
    private rpmCounter: Map<string, { count: number, resetAt: number }> = new Map();
    private tpmCounter: Map<string, { count: number, resetAt: number }> = new Map();
    private cooldowns: Map<string, number> = new Map();
    
    private adapters: ObservabilityAdapter[] = [];

    constructor(options: RouterOptions) {
        this.deployments = options.deployments;
        this.strategy = options.strategy || "least-tokens";
        this.timeout = options.timeout || 30000;
        this.retries = options.retries || 3;
        this.cooldownPeriod = options.cooldownPeriod || 60000;

        this.axiosInstance = axios.create({
            timeout: this.timeout,
        });

        this.axiosInstance.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 429) {
                    const deploymentId = error.config?.headers?.["X-Deployment-Id"];
                    if (deploymentId) {
                        this.cooldowns.set(deploymentId, Date.now() + this.cooldownPeriod);
                    }
                }
                return Promise.reject(error);
            }
        );

        this.deployments.forEach(d => {
            this.tokenUsageMap.set(d.id, 0);
            this.rpmCounter.set(d.id, { count: 0, resetAt: Date.now() + 60000 });
            this.tpmCounter.set(d.id, { count: 0, resetAt: Date.now() + 60000 });
        });
    }

    public addAdapter(adapter: ObservabilityAdapter) {
        this.adapters.push(adapter);
    }

    private selectDeployment(): DeploymentConfig {
        const now = Date.now();
        const available = this.deployments.filter(d => {
            const cooldownUntil = this.cooldowns.get(d.id) || 0;
            if (now < cooldownUntil) return false;

            const rpm = this.rpmCounter.get(d.id)!;
            if (now > rpm.resetAt) {
                rpm.count = 0;
                rpm.resetAt = now + 60000;
            }
            if (d.rpm && rpm.count >= d.rpm) return false;

            const tpm = this.tpmCounter.get(d.id)!;
            if (now > tpm.resetAt) {
                tpm.count = 0;
                tpm.resetAt = now + 60000;
            }
            if (d.tpm && tpm.count >= d.tpm) return false;

            return true;
        });

        let targets = available;
        if (targets.length === 0) {
            // No deployments are "available" (either in cooldown or over RPM/TPM limits).
            // We'll pick the one with the earliest cooldown reset.
            const deploymentsByCooldown = [...this.deployments].sort((a, b) => {
                const aCool = this.cooldowns.get(a.id) || 0;
                const bCool = this.cooldowns.get(b.id) || 0;
                return aCool - bCool;
            });
            targets = [deploymentsByCooldown[0]];
        }

        if (this.strategy === "least-tokens") {
            return targets.reduce((prev, curr) => {
                const prevUsage = this.tokenUsageMap.get(prev.id) || 0;
                const currUsage = this.tokenUsageMap.get(curr.id) || 0;
                return prevUsage <= currUsage ? prev : curr;
            });
        }
        
        if (this.strategy === "round-robin") {
            const deploymentsByUsage = [...targets].sort((a, b) => {
                const usageA = this.tokenUsageMap.get(a.id) || 0;
                const usageB = this.tokenUsageMap.get(b.id) || 0;
                return usageA - usageB;
            });
            const lowestUsage = this.tokenUsageMap.get(deploymentsByUsage[0].id) || 0;
            const candidates = deploymentsByUsage.filter(d => (this.tokenUsageMap.get(d.id) || 0) === lowestUsage);
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        if (this.strategy === "priority") {
            return targets.reduce((prev, curr) => {
                const prevPriority = prev.priority ?? 999;
                const currPriority = curr.priority ?? 999;
                return prevPriority <= currPriority ? prev : curr;
            });
        }

        return targets[0];
    }

    async chat(options: ChatOptions): Promise<SmartRouterResponse | AsyncIterable<string>> {
        if (options.stream) {
            return await retry(
                async () => {
                    const deployment = this.selectDeployment();
                    try {
                        // Return the async iterable directly
                        return this.callProviderStream(deployment, options);
                    } catch (error) {
                        this.adapters.forEach(a => a.onFailure(deployment, options, error));
                        throw error;
                    }
                },
                {
                    maxAttempts: this.retries,
                    handleError: (error, context) => {
                        console.error(`[SmartRouter] Stream attempt ${context.attemptNum} failed: ${error.message}`);
                    }
                }
            );
        }

        const startTime = Date.now();
        return await retry(
            async () => {
                const deployment = this.selectDeployment();
                try {
                    const response = await this.callProvider(deployment, options);
                    const usage = this.normalizeUsage(deployment, response.data);
                    const latency = Date.now() - startTime;

                    this.tokenUsageMap.set(deployment.id, (this.tokenUsageMap.get(deployment.id) || 0) + usage.total_tokens);
                    this.rpmCounter.get(deployment.id)!.count++;
                    this.tpmCounter.get(deployment.id)!.count += usage.total_tokens;

                    this.adapters.forEach(a => a.onSuccess(deployment, options, usage, latency));

                    return {
                        content: this.extractContent(deployment, response),
                        usage: usage,
                        model: deployment.model,
                        provider: deployment.provider,
                        deploymentId: deployment.id,
                    };
                } catch (error) {
                    this.adapters.forEach(a => a.onFailure(deployment, options, error));
                    throw error;
                }
            },
            {
                maxAttempts: this.retries,
                handleError: (error, context) => {
                    console.error(`[SmartRouter] Attempt ${context.attemptNum} failed: ${error.message}`);
                }
            }
        );
    }

    private async callProvider(deployment: DeploymentConfig, options: ChatOptions): Promise<AxiosResponse> {
        const { url, body, headers } = this.prepareRequest(deployment, options);
        return await this.axiosInstance.post(url, body, { 
            headers: { ...headers, "X-Deployment-Id": deployment.id } 
        });
    }

    private async *callProviderStream(deployment: DeploymentConfig, options: ChatOptions): AsyncIterable<string> {
        const { url, body, headers } = this.prepareRequest(deployment, options);
        const response = await this.axiosInstance.post(url, body, { 
            headers: { ...headers, "X-Deployment-Id": deployment.id }, 
            responseType: "stream" 
        });

        const stream = response.data;
        let buffer = "";

        for await (const chunk of stream) {
            buffer += chunk.toString();
            
            if (deployment.provider === "openai" || deployment.provider === "openrouter") {
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                    const line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);
                    
                    if (line.startsWith("data: ")) {
                        const message = line.slice(6);
                        if (message === "[DONE]") return;
                        try {
                            const parsed = JSON.parse(message);
                            const content = this.extractStreamContent(deployment, parsed);
                            if (content) yield content;
                        } catch (e) {
                            // If invalid JSON, ignore and continue
                        }
                    }
                }
            } else if (deployment.provider === "google") {
                // Gemini returns JSON fragments, sometimes wrapped in an array [ ... ]
                // We use a robust brace-counting approach with a buffer.
                buffer = buffer.trimStart();
                if (buffer.startsWith("[")) {
                    buffer = buffer.slice(1).trimStart();
                }

                let braceCount = 0;
                let startPos = -1;
                let i = 0;
                while (i < buffer.length) {
                    if (buffer[i] === "{") {
                        if (braceCount === 0) startPos = i;
                        braceCount++;
                    } else if (buffer[i] === "}") {
                        braceCount--;
                        if (braceCount === 0 && startPos !== -1) {
                            const jsonStr = buffer.slice(startPos, i + 1);
                            try {
                                const parsed = JSON.parse(jsonStr);
                                const content = this.extractStreamContent(deployment, parsed);
                                if (content) yield content;
                                
                                // Successfully processed an object, consume it from buffer
                                buffer = buffer.slice(i + 1).trimStart();
                                // Skip delimiters
                                if (buffer.startsWith(",")) {
                                    buffer = buffer.slice(1).trimStart();
                                } else if (buffer.startsWith("]")) {
                                    buffer = buffer.slice(1).trimStart();
                                }
                                i = -1; // Reset to start of updated buffer
                                startPos = -1;
                            } catch (e) {
                                // Likely incomplete JSON, keep in buffer
                            }
                        }
                    }
                    i++;
                }
            } else {
                yield buffer;
                buffer = "";
            }
        }
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
            body.messages = options.messages;
        } else if (deployment.provider === "google") {
            const method = options.stream ? "streamGenerateContent" : "generateContent";
            url = url || `https://generativelanguage.googleapis.com/v1/models/${deployment.model}:${method}?key=${deployment.apiKey}`;
            const systemMessage = options.messages.find(m => m.role === "system");
            const otherMessages = options.messages.filter(m => m.role !== "system");
            
            body = {
                contents: otherMessages.map(m => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }]
                })),
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    maxOutputTokens: options.max_tokens || 512,
                }
            };

            if (systemMessage) {
                (body as any).systemInstruction = {
                    parts: [{ text: systemMessage.content }]
                };
            }
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
        if (deployment.provider === "openai" || deployment.provider === "openrouter") return response.data.choices?.[0]?.message?.content || "";
        if (deployment.provider === "google") return response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (deployment.provider === "cohere") return response.data.text || "";
        return "";
    }

    private extractStreamContent(deployment: DeploymentConfig, parsed: any): string {
        if (deployment.provider === "openai" || deployment.provider === "openrouter") return parsed.choices[0]?.delta?.content || "";
        if (deployment.provider === "google") return parsed.candidates[0]?.content?.parts[0]?.text || "";
        if (deployment.provider === "cohere") return parsed.text || "";
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
}

export const createSentryAdapter = (Sentry: any): ObservabilityAdapter => ({
    onSuccess: (deployment, options, usage, latency) => {
        Sentry.captureMessage(`[SmartRouter] Success: ${deployment.id}`, {
            level: "info",
            extra: { deployment, usage, latency }
        });
    },
    onFailure: (deployment, options, error) => {
        Sentry.captureException(error, {
            extra: { deployment, options }
        });
    }
});

export const createPostHogAdapter = (posthog: any): ObservabilityAdapter => ({
    onSuccess: (deployment, options, usage, latency) => {
        posthog.capture({
            event: "smart_router_request_success",
            properties: {
                deployment_id: deployment.id,
                provider: deployment.provider,
                model: deployment.model,
                usage,
                latency_ms: latency
            }
        });
    },
    onFailure: (deployment, options, error) => {
        posthog.capture({
            event: "smart_router_request_failure",
            properties: {
                deployment_id: deployment.id,
                error: error.message,
                status: error.response?.status
            }
        });
    }
});

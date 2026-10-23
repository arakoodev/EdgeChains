import axios, { AxiosInstance } from "axios";
import fs from "fs";

export type SupportedProvider = "openai" | "palm" | "cohere";

export interface DeploymentConfig {
    id: string;
    provider: SupportedProvider;
    model: string;
    apiKey: string;
    endpointUrl?: string;
    rpmLimit?: number;
    tpmLimit?: number;
    timeoutMs?: number;
    maxRetries?: number;
}

export interface ObservabilityConfig {
    sentryDsn?: string;
    posthogApiKey?: string;
    posthogHost?: string;
}

export interface SmartRouterConfig {
    deployments: DeploymentConfig[];
    defaultTimeoutMs?: number;
    defaultMaxRetries?: number;
    retryDelayMs?: number;
    observability?: ObservabilityConfig;
    httpClient?: AxiosInstance;
}

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface RouterCompletionRequest {
    prompt: string;
    provider?: SupportedProvider;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    onToken?: (chunk: string) => void;
}

export interface RouterCompletionResponse {
    deploymentId: string;
    provider: SupportedProvider;
    model: string;
    content: string;
    usage: TokenUsage;
    streamedChunks?: string[];
}

export interface TelemetryEvent {
    target: "sentry" | "posthog";
    event: string;
    deploymentId: string;
    provider: SupportedProvider;
    model: string;
    usage?: TokenUsage;
    error?: string;
    timestamp: string;
}

interface DeploymentRuntimeState {
    requestsInWindow: number;
    tokensUsed: number;
    cooldownUntilMs: number;
}

export function loadRouterJsonnetConfig(jsonnetPath: string): SmartRouterConfig {
    const raw = fs.readFileSync(jsonnetPath, "utf8");
    const cleaned = raw
        .split("\n")
        .map((line) => line.replace(/^\s*\/\/.*$/, ""))
        .join("\n")
        .trim();
    return JSON.parse(cleaned);
}

export function estimateTokens(text: string): number {
    const trimmed = (text || "").trim();
    if (!trimmed) return 0;
    return Math.max(1, Math.ceil(trimmed.split(/\s+/).length * 1.3));
}

export class SmartRouter {
    readonly deployments: DeploymentConfig[];
    readonly defaultTimeoutMs: number;
    readonly defaultMaxRetries: number;
    readonly retryDelayMs: number;
    readonly observability?: ObservabilityConfig;
    readonly telemetryLog: TelemetryEvent[] = [];
    readonly http: AxiosInstance;
    private readonly state: Map<string, DeploymentRuntimeState> = new Map();

    constructor(config: SmartRouterConfig) {
        if (!config.deployments || config.deployments.length === 0) {
            throw new Error("SmartRouter requires at least one deployment");
        }
        this.deployments = config.deployments;
        this.defaultTimeoutMs = config.defaultTimeoutMs ?? 10000;
        this.defaultMaxRetries = config.defaultMaxRetries ?? 2;
        this.retryDelayMs = config.retryDelayMs ?? 10;
        this.observability = config.observability;
        this.http = config.httpClient || axios.create();

        for (const dep of this.deployments) {
            this.state.set(dep.id, {
                requestsInWindow: 0,
                tokensUsed: 0,
                cooldownUntilMs: 0,
            });
        }

        this.installReliabilityInterceptors();
    }

    private installReliabilityInterceptors(): void {
        if (!this.http?.interceptors?.response?.use) return;
        this.http.interceptors.response.use(
            (response) => response,
            async (error) => {
                const cfg = error?.config;
                if (!cfg) return Promise.reject(error);
                const maxRetries = cfg.__maxRetries ?? this.defaultMaxRetries;
                cfg.__retryCount = cfg.__retryCount ?? 0;

                const status = error?.response?.status;
                const isRetryable =
                    error?.code === "ECONNABORTED" ||
                    !status ||
                    status === 429 ||
                    (status >= 500 && status < 600);

                if (isRetryable && cfg.__retryCount < maxRetries) {
                    cfg.__retryCount += 1;
                    if (this.retryDelayMs > 0) {
                        await new Promise((r) => setTimeout(r, this.retryDelayMs));
                    }
                    return this.http.request(cfg);
                }
                return Promise.reject(error);
            }
        );
    }

    getDeploymentState(deploymentId: string): DeploymentRuntimeState {
        const s = this.state.get(deploymentId);
        if (!s) throw new Error(`Unknown deployment: ${deploymentId}`);
        return { ...s };
    }

    recordUsage(deploymentId: string, tokens: number, requests: number = 1): void {
        const s = this.state.get(deploymentId);
        if (!s) return;
        s.requestsInWindow += requests;
        s.tokensUsed += tokens;
    }

    /**
     * Picks the healthy deployment below rate-limit (RPM/TPM) with the least tokens used.
     */
    selectDeployment(
        filterProvider?: SupportedProvider,
        filterModel?: string,
        excludedIds: Set<string> = new Set()
    ): DeploymentConfig {
        const now = Date.now();
        const eligible = this.deployments.filter((dep) => {
            if (excludedIds.has(dep.id)) return false;
            if (filterProvider && dep.provider !== filterProvider) return false;
            if (filterModel && dep.model !== filterModel) return false;
            const st = this.state.get(dep.id)!;
            if (st.cooldownUntilMs > now) return false;
            if (dep.rpmLimit !== undefined && st.requestsInWindow >= dep.rpmLimit) return false;
            if (dep.tpmLimit !== undefined && st.tokensUsed >= dep.tpmLimit) return false;
            return true;
        });

        if (eligible.length === 0) {
            throw new Error("No eligible deployments available below rate limits");
        }

        eligible.sort((a, b) => {
            const sa = this.state.get(a.id)!;
            const sb = this.state.get(b.id)!;
            if (sa.tokensUsed !== sb.tokensUsed) {
                return sa.tokensUsed - sb.tokensUsed;
            }
            return sa.requestsInWindow - sb.requestsInWindow;
        });

        return eligible[0];
    }

    private emitObservability(
        event: "completion_success" | "completion_error",
        dep: DeploymentConfig,
        usage?: TokenUsage,
        error?: string
    ): void {
        const timestamp = new Date().toISOString();
        if (this.observability?.posthogApiKey && event === "completion_success") {
            this.telemetryLog.push({
                target: "posthog",
                event,
                deploymentId: dep.id,
                provider: dep.provider,
                model: dep.model,
                usage,
                timestamp,
            });
        }
        if (this.observability?.sentryDsn && event === "completion_error") {
            this.telemetryLog.push({
                target: "sentry",
                event,
                deploymentId: dep.id,
                provider: dep.provider,
                model: dep.model,
                error,
                timestamp,
            });
        }
    }

    private buildProviderPayload(dep: DeploymentConfig, req: RouterCompletionRequest) {
        if (dep.provider === "openai") {
            return {
                url: dep.endpointUrl || "https://api.openai.com/v1/chat/completions",
                headers: {
                    Authorization: `Bearer ${dep.apiKey}`,
                    "Content-Type": "application/json",
                },
                data: {
                    model: dep.model,
                    messages: [{ role: "user", content: req.prompt }],
                    max_tokens: req.maxTokens ?? 256,
                    temperature: req.temperature ?? 0.7,
                    stream: Boolean(req.stream),
                },
            };
        }
        if (dep.provider === "palm") {
            const base =
                dep.endpointUrl ||
                `https://generativelanguage.googleapis.com/v1beta2/models/${dep.model}:generateText`;
            return {
                url: `${base}?key=${encodeURIComponent(dep.apiKey)}`,
                headers: { "Content-Type": "application/json" },
                data: {
                    prompt: { text: req.prompt },
                    temperature: req.temperature ?? 0.7,
                    maxOutputTokens: req.maxTokens ?? 256,
                },
            };
        }
        // cohere
        return {
            url: dep.endpointUrl || "https://api.cohere.ai/v1/generate",
            headers: {
                Authorization: `Bearer ${dep.apiKey}`,
                "Content-Type": "application/json",
            },
            data: {
                model: dep.model,
                prompt: req.prompt,
                max_tokens: req.maxTokens ?? 256,
                temperature: req.temperature ?? 0.7,
                stream: Boolean(req.stream),
            },
        };
    }

    private parseProviderResponse(
        dep: DeploymentConfig,
        prompt: string,
        rawData: any
    ): { content: string; usage: TokenUsage; chunks?: string[] } {
        let content = "";
        let chunks: string[] | undefined;

        if (Array.isArray(rawData?.chunks)) {
            const mappedChunks: string[] = rawData.chunks.map(String);
            chunks = mappedChunks;
            content = mappedChunks.join("");
        } else if (dep.provider === "openai") {
            content = rawData?.choices?.[0]?.message?.content ?? rawData?.choices?.[0]?.delta?.content ?? "";
        } else if (dep.provider === "palm") {
            content = rawData?.candidates?.[0]?.output ?? rawData?.candidates?.[0]?.content ?? "";
        } else if (dep.provider === "cohere") {
            content = rawData?.generations?.[0]?.text ?? rawData?.text ?? "";
        }

        const promptTokens = rawData?.usage?.prompt_tokens ?? estimateTokens(prompt);
        const completionTokens = rawData?.usage?.completion_tokens ?? estimateTokens(content);
        const totalTokens = rawData?.usage?.total_tokens ?? promptTokens + completionTokens;

        return {
            content,
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: totalTokens,
            },
            chunks,
        };
    }

    async chat(req: RouterCompletionRequest): Promise<RouterCompletionResponse> {
        const tried = new Set<string>();
        let lastError: any = null;

        while (tried.size < this.deployments.length) {
            let dep: DeploymentConfig;
            try {
                dep = this.selectDeployment(req.provider, req.model, tried);
            } catch (err) {
                if (lastError) throw lastError;
                throw err;
            }
            tried.add(dep.id);

            const { url, headers, data } = this.buildProviderPayload(dep, req);
            try {
                const res = await this.http.request({
                    method: "POST",
                    url,
                    headers,
                    data,
                    timeout: dep.timeoutMs ?? this.defaultTimeoutMs,
                    ...({ __maxRetries: dep.maxRetries ?? this.defaultMaxRetries } as any),
                });

                const parsed = this.parseProviderResponse(dep, req.prompt, res.data);
                if (req.stream && req.onToken) {
                    const streamPieces =
                        parsed.chunks ?? parsed.content.split(/(?=\s)/).filter(Boolean);
                    for (const piece of streamPieces) {
                        req.onToken(piece);
                    }
                    parsed.chunks = streamPieces;
                }

                this.recordUsage(dep.id, parsed.usage.total_tokens, 1);
                this.emitObservability("completion_success", dep, parsed.usage);

                return {
                    deploymentId: dep.id,
                    provider: dep.provider,
                    model: dep.model,
                    content: parsed.content,
                    usage: parsed.usage,
                    streamedChunks: parsed.chunks,
                };
            } catch (err: any) {
                lastError = err;
                const st = this.state.get(dep.id)!;
                st.cooldownUntilMs = Date.now() + 1000;
                this.emitObservability(
                    "completion_error",
                    dep,
                    undefined,
                    err?.message || String(err)
                );
            }
        }

        throw lastError || new Error("All deployments failed");
    }

    async streamedChat(
        req: RouterCompletionRequest,
        onToken?: (chunk: string) => void
    ): Promise<RouterCompletionResponse> {
        return this.chat({
            ...req,
            stream: true,
            onToken: onToken ?? req.onToken,
        });
    }
}

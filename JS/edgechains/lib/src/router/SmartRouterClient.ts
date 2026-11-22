import axios, { type AxiosInstance } from "axios";

export interface LibDeploymentConfig {
    deploymentId?: string;
    modelName: string;
    provider?: "openai" | "palm" | "gemini" | "cohere" | "llama" | "custom";
    model?: string;
    apiKey?: string;
    orgId?: string;
    apiBase?: string;
    rpm?: number;
    tpm?: number;
    priority?: number;
    weight?: number;
}

export interface LibRouterConfig {
    routingStrategy?:
        | "least-tokens"
        | "usage-based-routing"
        | "simple-shuffle"
        | "least-busy"
        | "latency-based-routing"
        | "cost-based-routing";
    numRetries?: number;
    retryAfter?: number;
    timeout?: number;
    cooldownTime?: number;
    allowedFails?: number;
    defaultModel?: string;
    modelList?: LibDeploymentConfig[];
}

export class SmartRouter {
    readonly config: LibRouterConfig;
    readonly httpClient: AxiosInstance;
    private readonly deployments: LibDeploymentConfig[];
    private readonly tokenUsage = new Map<string, number>();

    constructor(config: LibRouterConfig = {}) {
        this.config = config;
        this.deployments = config.modelList ? [...config.modelList] : [];
        this.httpClient = axios.create({
            timeout: config.timeout ?? 30000,
        });
        this.httpClient.interceptors.response.use(
            (response) => response,
            async (error) => Promise.reject(error)
        );
    }

    selectDeployment(modelName?: string): LibDeploymentConfig {
        const target = modelName || this.config.defaultModel || "gpt-3.5-turbo";
        const matches = this.deployments.filter(
            (d) => d.modelName === target || d.model === target
        );
        const pool = matches.length > 0 ? matches : this.deployments;
        if (pool.length === 0) {
            return {
                deploymentId: "default-openai",
                modelName: target,
                provider: "openai",
                model: target,
                apiKey: process.env.OPENAI_API_KEY || "",
                orgId: process.env.OPENAI_ORG_ID || "",
            };
        }
        return [...pool].sort((a, b) => {
            const idA = a.deploymentId || a.modelName;
            const idB = b.deploymentId || b.modelName;
            return (this.tokenUsage.get(idA) ?? 0) - (this.tokenUsage.get(idB) ?? 0);
        })[0];
    }

    async completion(options: {
        model?: string;
        prompt?: string;
        messages?: Array<{ role: string; content: string }>;
        role?: string;
        temperature?: number;
        max_tokens?: number;
    }): Promise<{ content: string; usage: { total_tokens: number } }> {
        const dep = this.selectDeployment(options.model);
        const base = (dep.apiBase || "https://api.openai.com/v1").replace(/\/+$/, "");
        const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
        const messages =
            options.messages && options.messages.length > 0
                ? options.messages
                : [{ role: options.role || "user", content: options.prompt || "" }];

        const response = await this.httpClient.post(
            url,
            {
                model: dep.model || dep.modelName || "gpt-3.5-turbo",
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.max_tokens ?? 256,
            },
            {
                headers: {
                    Authorization: `Bearer ${dep.apiKey || ""}`,
                    "content-type": "application/json",
                    ...(dep.orgId ? { "OpenAI-Organization": dep.orgId } : {}),
                },
            }
        );

        const content = response.data?.choices?.[0]?.message?.content || "";
        const totalTokens = response.data?.usage?.total_tokens ?? content.length;
        const depId = dep.deploymentId || dep.modelName;
        this.tokenUsage.set(depId, (this.tokenUsage.get(depId) ?? 0) + totalTokens);
        return {
            content,
            usage: { total_tokens: totalTokens },
        };
    }

    async embeddings(input: string, model = "text-embedding-ada-002"): Promise<number[]> {
        const dep = this.selectDeployment(model);
        const base = (dep.apiBase || "https://api.openai.com/v1").replace(/\/+$/, "");
        const url = base.endsWith("/embeddings") ? base : `${base}/embeddings`;
        const response = await this.httpClient.post(
            url,
            {
                model,
                input,
            },
            {
                headers: {
                    Authorization: `Bearer ${dep.apiKey || ""}`,
                    "content-type": "application/json",
                    ...(dep.orgId ? { "OpenAI-Organization": dep.orgId } : {}),
                },
            }
        );
        return response.data?.data?.[0]?.embedding || [];
    }
}

export { SmartRouter as Router };

export class OpenAiEndpoint {
    readonly router: SmartRouter;
    readonly model: string;
    readonly role: string;
    readonly temperature: number;

    constructor(
        url = "https://api.openai.com/v1/chat/completions",
        apiKey = "",
        orgId = "",
        model = "gpt-3.5-turbo",
        role = "user",
        temperature = 0.7
    ) {
        this.model = model;
        this.role = role;
        this.temperature = Number.isFinite(temperature) && temperature > 0 ? temperature : 0.7;
        this.router = new SmartRouter({
            defaultModel: model,
            modelList: [
                {
                    deploymentId: "openai-endpoint-primary",
                    modelName: model,
                    provider: "openai",
                    model,
                    apiKey,
                    orgId,
                    apiBase: url.replace(/\/chat\/completions\/?$/, ""),
                },
            ],
        });
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

    async gptFnChat(messages: Array<{ role: string; content: string }>): Promise<string> {
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
        return this.router.embeddings(input);
    }
}

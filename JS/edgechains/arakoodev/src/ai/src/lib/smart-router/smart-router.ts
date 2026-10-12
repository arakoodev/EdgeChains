import { OpenAI } from "../openai/openai.js";
import { GeminiAI } from "../gemini/gemini.js";
import { LlamaAI } from "../llama/llama.js";
import { role } from "../../types/index.js";

export type RoutingStrategy = "round-robin" | "least-busy" | "random";

export interface ModelDeployment {
    modelName: string;
    litellmParams: {
        model: string;
        apiKey?: string;
        orgId?: string;
        provider?: "openai" | "gemini" | "llama";
    };
    tpm?: number;
    rpm?: number;
    maxRetries?: number;
    timeout?: number;
}

export interface SmartRouterOptions {
    modelList: ModelDeployment[];
    routingStrategy?: RoutingStrategy;
    fallbacks?: Record<string, string[]>;
    allowedFails?: number;
    cooldownTimeMs?: number;
}

export interface RouterChatOptions {
    model: string;
    prompt?: string;
    role?: role;
    messages?: Array<{ role: role; content: string; name?: string }>;
    maxTokens?: number;
    temperature?: number;
}

export interface RouterChatResponse {
    content: string;
    model: string;
    provider: string;
    rawResponse?: any;
}

interface DeploymentState {
    deployment: ModelDeployment;
    activeRequests: number;
    failureCount: number;
    cooldownUntil: number;
}

export class SmartRouter {
    private deployments: DeploymentState[] = [];
    private routingStrategy: RoutingStrategy;
    private fallbacks: Record<string, string[]>;
    private allowedFails: number;
    private cooldownTimeMs: number;
    private roundRobinIndex: Map<string, number> = new Map();

    constructor(options: SmartRouterOptions) {
        this.routingStrategy = options.routingStrategy || "round-robin";
        this.fallbacks = options.fallbacks || {};
        this.allowedFails = options.allowedFails ?? 3;
        this.cooldownTimeMs = options.cooldownTimeMs ?? 60000;

        for (const dep of options.modelList) {
            this.deployments.push({
                deployment: dep,
                activeRequests: 0,
                failureCount: 0,
                cooldownUntil: 0,
            });
        }
    }

    private getAvailableDeployments(modelName: string): DeploymentState[] {
        const now = Date.now();
        return this.deployments.filter(
            (d) => d.deployment.modelName === modelName && d.cooldownUntil <= now
        );
    }

    private selectDeployment(modelName: string): DeploymentState {
        const available = this.getAvailableDeployments(modelName);
        if (available.length === 0) {
            // Check if any exists at all
            const exists = this.deployments.some((d) => d.deployment.modelName === modelName);
            if (!exists) {
                throw new Error(`No deployment registered for model: ${modelName}`);
            }
            throw new Error(`All deployments for model ${modelName} are currently cooling down.`);
        }

        switch (this.routingStrategy) {
            case "random": {
                const idx = Math.floor(Math.random() * available.length);
                return available[idx];
            }
            case "least-busy": {
                return available.reduce((prev, curr) =>
                    curr.activeRequests < prev.activeRequests ? curr : prev
                );
            }
            case "round-robin":
            default: {
                const currentIndex = this.roundRobinIndex.get(modelName) || 0;
                const nextIndex = currentIndex % available.length;
                this.roundRobinIndex.set(modelName, nextIndex + 1);
                return available[nextIndex];
            }
        }
    }

    private inferProvider(dep: ModelDeployment): "openai" | "gemini" | "llama" {
        if (dep.litellmParams.provider) {
            return dep.litellmParams.provider;
        }
        const m = dep.litellmParams.model.toLowerCase();
        if (m.includes("gpt") || m.includes("openai") || m.includes("davinci")) return "openai";
        if (m.includes("gemini") || m.includes("palm")) return "gemini";
        if (m.includes("llama")) return "llama";
        return "openai";
    }

    private async executeChatWithDeployment(
        depState: DeploymentState,
        options: RouterChatOptions
    ): Promise<RouterChatResponse> {
        depState.activeRequests++;
        const provider = this.inferProvider(depState.deployment);
        const apiKey = depState.deployment.litellmParams.apiKey || "";

        try {
            if (provider === "openai") {
                const client = new OpenAI({
                    apiKey,
                    orgId: depState.deployment.litellmParams.orgId,
                });
                const res = await client.chat({
                    model: depState.deployment.litellmParams.model as any,
                    prompt: options.prompt,
                    messages: options.messages,
                    role: options.role,
                    max_tokens: options.maxTokens,
                    temperature: options.temperature,
                });
                depState.failureCount = 0;
                return {
                    content: res?.content || "",
                    model: depState.deployment.modelName,
                    provider: "openai",
                    rawResponse: res,
                };
            } else if (provider === "gemini") {
                const client = new GeminiAI({ apiKey });
                const prompt = options.prompt || options.messages?.map((m) => m.content).join("\n") || "";
                const res = await client.chat({
                    model: depState.deployment.litellmParams.model,
                    prompt,
                    temperature: options.temperature,
                    max_output_tokens: options.maxTokens,
                });
                const text = res?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                depState.failureCount = 0;
                return {
                    content: text,
                    model: depState.deployment.modelName,
                    provider: "gemini",
                    rawResponse: res,
                };
            } else if (provider === "llama") {
                const client = new LlamaAI({ apiKey });
                const res: any = await client.chat({
                    model: depState.deployment.litellmParams.model,
                    prompt: options.prompt,
                    messages: options.messages,
                    role: options.role,
                    max_tokens: options.maxTokens,
                    temperature: options.temperature,
                });
                const text = res?.choices?.[0]?.message?.content || res?.content || "";
                depState.failureCount = 0;
                return {
                    content: text,
                    model: depState.deployment.modelName,
                    provider: "llama",
                    rawResponse: res,
                };
            } else {
                throw new Error(`Unsupported provider: ${provider}`);
            }
        } catch (error) {
            depState.failureCount++;
            if (depState.failureCount >= this.allowedFails) {
                depState.cooldownUntil = Date.now() + this.cooldownTimeMs;
            }
            throw error;
        } finally {
            depState.activeRequests--;
        }
    }

    async chat(options: RouterChatOptions): Promise<RouterChatResponse> {
        const candidateModels = [options.model, ...(this.fallbacks[options.model] || [])];
        let lastError: any = null;

        for (const modelToTry of candidateModels) {
            try {
                const depState = this.selectDeployment(modelToTry);
                return await this.executeChatWithDeployment(depState, options);
            } catch (err) {
                lastError = err;
                continue;
            }
        }

        throw new Error(
            `SmartRouter failed across all candidate models [${candidateModels.join(", ")}]. Last error: ${lastError?.message || lastError}`
        );
    }
}

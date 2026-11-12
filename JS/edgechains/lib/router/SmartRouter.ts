import axios, { AxiosInstance } from "axios";

export interface ModelDeployment {
    id: string;
    provider: "openai" | "palm" | "cohere";
    endpoint: string;
    apiKey: string;
    model: string;
    rpmLimit: number;
    tpmLimit: number;
    currentRpm?: number;
    currentTokensUsed?: number;
    cooldownUntil?: number;
}

export interface RouterOptions {
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
}

export class SmartRouter {
    private deployments: ModelDeployment[];
    private timeoutMs: number;
    private maxRetries: number;
    private retryDelayMs: number;
    private http: AxiosInstance;

    constructor(deployments: ModelDeployment[], options: RouterOptions = {}) {
        this.deployments = deployments.map((d) => ({
            ...d,
            currentRpm: d.currentRpm ?? 0,
            currentTokensUsed: d.currentTokensUsed ?? 0,
            cooldownUntil: d.cooldownUntil ?? 0,
        }));
        this.timeoutMs = options.timeoutMs ?? 15000;
        this.maxRetries = options.maxRetries ?? 3;
        this.retryDelayMs = options.retryDelayMs ?? 300;
        this.http = axios.create({ timeout: this.timeoutMs });
    }

    public selectOptimalDeployment(estimatedTokens = 100): ModelDeployment {
        const now = Date.now();
        const eligible = this.deployments.filter(
            (d) =>
                (d.cooldownUntil ?? 0) <= now &&
                (d.currentRpm ?? 0) < d.rpmLimit &&
                (d.currentTokensUsed ?? 0) + estimatedTokens <= d.tpmLimit
        );
        if (eligible.length === 0) {
            throw new Error("All configured deployments have exceeded rate/token limits or are in cooldown.");
        }
        eligible.sort((a, b) => (a.currentTokensUsed ?? 0) - (b.currentTokensUsed ?? 0));
        return eligible[0];
    }

    public async completion(prompt: string): Promise<{ provider: string; deploymentId: string; text: string; tokensUsed: number }> {
        const estTokens = Math.max(1, Math.ceil(prompt.length / 4));
        let lastErr: unknown = null;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            const target = this.selectOptimalDeployment(estTokens);
            try {
                target.currentRpm = (target.currentRpm ?? 0) + 1;
                const payload = this.buildProviderPayload(target, prompt);
                const resp = await this.http.post(target.endpoint, payload, {
                    headers: { Authorization: `Bearer ${target.apiKey}`, "Content-Type": "application/json" },
                });
                const parsed = this.parseProviderResponse(target, resp.data, estTokens);
                target.currentTokensUsed = (target.currentTokensUsed ?? 0) + parsed.tokensUsed;
                return {
                    provider: target.provider,
                    deploymentId: target.id,
                    text: parsed.text,
                    tokensUsed: parsed.tokensUsed,
                };
            } catch (err) {
                lastErr = err;
                target.cooldownUntil = Date.now() + this.retryDelayMs * Math.pow(2, attempt);
            }
        }
        throw lastErr instanceof Error ? lastErr : new Error("SmartRouter exhausted all retries across deployments.");
    }

    private buildProviderPayload(d: ModelDeployment, prompt: string): Record<string, unknown> {
        if (d.provider === "openai") {
            return { model: d.model, messages: [{ role: "user", content: prompt }] };
        }
        if (d.provider === "cohere") {
            return { model: d.model, prompt, max_tokens: 512 };
        }
        return { prompt: { text: prompt } };
    }

    private parseProviderResponse(d: ModelDeployment, data: any, fallbackTokens: number): { text: string; tokensUsed: number } {
        if (d.provider === "openai") {
            const text = data?.choices?.[0]?.message?.content ?? "";
            const tokens = data?.usage?.total_tokens ?? fallbackTokens;
            return { text, tokensUsed: tokens };
        }
        if (d.provider === "cohere") {
            const text = data?.generations?.[0]?.text ?? "";
            return { text, tokensUsed: fallbackTokens };
        }
        const text = data?.candidates?.[0]?.output ?? "";
        return { text, tokensUsed: fallbackTokens };
    }
}

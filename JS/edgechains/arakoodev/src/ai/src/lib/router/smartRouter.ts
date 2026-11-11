export type SupportedProvider = 'openai' | 'palm2' | 'cohere';

export interface DeploymentConfig {
    id: string;
    provider: SupportedProvider;
    model: string;
    apiKey: string;
    rateLimitRpm: number;
    rateLimitTpm: number;
    costPer1kTokensUsd?: number;
    handler?: (prompt: string, model: string) => Promise<{ text: string; tokensUsed: number }>;
}

export interface DeploymentState {
    config: DeploymentConfig;
    requestsInWindow: number;
    tokensUsedTotal: number;
    failures: number;
    cooldownUntilMs: number;
    totalCostUsd: number;
}

export interface RouterCompletionResult {
    deploymentId: string;
    provider: SupportedProvider;
    model: string;
    text: string;
    tokensUsed: number;
    attempts: number;
}

export class SmartRouter {
    private deployments: Map<string, DeploymentState> = new Map();
    private maxRetries: number;
    private cooldownMs: number;

    constructor(
        configs: DeploymentConfig[],
        options: { maxRetries?: number; cooldownMs?: number } = {}
    ) {
        if (!configs || configs.length === 0) {
            throw new Error('At least one deployment is required for SmartRouter');
        }
        this.maxRetries = options.maxRetries ?? 3;
        this.cooldownMs = options.cooldownMs ?? 30_000;
        for (const cfg of configs) {
            this.deployments.set(cfg.id, {
                config: cfg,
                requestsInWindow: 0,
                tokensUsedTotal: 0,
                failures: 0,
                cooldownUntilMs: 0,
                totalCostUsd: 0,
            });
        }
    }

    selectBestDeployment(nowMs = Date.now(), excludedIds: Set<string> = new Set()): DeploymentState {
        const candidates = Array.from(this.deployments.values()).filter((d) => {
            if (excludedIds.has(d.config.id)) return false;
            if (d.cooldownUntilMs > nowMs) return false;
            if (d.requestsInWindow >= d.config.rateLimitRpm) return false;
            if (d.tokensUsedTotal >= d.config.rateLimitTpm) return false;
            return true;
        });

        if (candidates.length === 0) {
            throw new Error('No healthy deployments available below rate limit');
        }

        // Sort by least tokens used first, then fewest requests in window
        candidates.sort((a, b) => {
            if (a.tokensUsedTotal !== b.tokensUsedTotal) {
                return a.tokensUsedTotal - b.tokensUsedTotal;
            }
            return a.requestsInWindow - b.requestsInWindow;
        });

        return candidates[0];
    }

    async complete(prompt: string, nowMs = Date.now()): Promise<RouterCompletionResult> {
        const excluded = new Set<string>();
        let attempts = 0;
        let lastError: unknown = null;

        while (attempts < this.maxRetries) {
            attempts += 1;
            const target = this.selectBestDeployment(nowMs, excluded);
            try {
                target.requestsInWindow += 1;
                if (!target.config.handler) {
                    throw new Error(`Missing handler for deployment ${target.config.id}`);
                }
                const res = await target.config.handler(prompt, target.config.model);
                const tokens = Number(res.tokensUsed || Math.ceil(prompt.length / 4));
                target.tokensUsedTotal += tokens;
                const rate = target.config.costPer1kTokensUsd ?? 0.002;
                target.totalCostUsd = Number(
                    (target.totalCostUsd + (tokens / 1000) * rate).toFixed(6)
                );
                return {
                    deploymentId: target.config.id,
                    provider: target.config.provider,
                    model: target.config.model,
                    text: res.text,
                    tokensUsed: tokens,
                    attempts,
                };
            } catch (err) {
                lastError = err;
                target.failures += 1;
                target.cooldownUntilMs = nowMs + this.cooldownMs;
                excluded.add(target.config.id);
            }
        }

        throw lastError instanceof Error
            ? lastError
            : new Error('SmartRouter exhausted all retries across deployments');
    }

    getTelemetry() {
        return Array.from(this.deployments.values()).map((d) => ({
            id: d.config.id,
            provider: d.config.provider,
            model: d.config.model,
            requestsInWindow: d.requestsInWindow,
            tokensUsedTotal: d.tokensUsedTotal,
            failures: d.failures,
            totalCostUsd: d.totalCostUsd,
        }));
    }
}

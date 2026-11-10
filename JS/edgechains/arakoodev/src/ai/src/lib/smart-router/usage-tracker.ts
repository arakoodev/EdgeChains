import type { DeploymentStats, ModelDeployment, Provider, TokenUsage } from "./types.js";

const RATE_WINDOW_MS = 60_000; // 1 minute window

export class UsageTracker {
    private stats: Map<string, DeploymentStats> = new Map();

    private key(deployment: ModelDeployment): string {
        return `${deployment.provider}:${deployment.model}`;
    }

    getStats(deployment: ModelDeployment): DeploymentStats {
        const k = this.key(deployment);
        if (!this.stats.has(k)) {
            this.stats.set(k, {
                provider: deployment.provider,
                model: deployment.model,
                totalRequests: 0,
                totalTokensUsed: 0,
                requestsInWindow: 0,
                tokensInWindow: 0,
                lastRequestTime: 0,
                failures: 0,
            });
        }
        return this.stats.get(k)!;
    }

    record(deployment: ModelDeployment, usage: TokenUsage): void {
        const stats = this.getStats(deployment);
        stats.totalRequests++;
        stats.totalTokensUsed += usage.totalTokens;
        stats.requestsInWindow++;
        stats.tokensInWindow += usage.totalTokens;
        stats.lastRequestTime = Date.now();
    }

    recordFailure(deployment: ModelDeployment): void {
        const stats = this.getStats(deployment);
        stats.failures++;
    }

    isWithinRateLimit(deployment: ModelDeployment): boolean {
        const stats = this.getStats(deployment);
        const now = Date.now();

        // Reset window if expired
        if (now - stats.lastRequestTime > RATE_WINDOW_MS) {
            stats.requestsInWindow = 0;
            stats.tokensInWindow = 0;
        }

        if (deployment.rpmLimit && stats.requestsInWindow >= deployment.rpmLimit) {
            return false;
        }
        if (deployment.tpmLimit && stats.tokensInWindow >= deployment.tpmLimit) {
            return false;
        }
        return true;
    }

    getAllStats(): DeploymentStats[] {
        return Array.from(this.stats.values());
    }

    getTotalUsage(): TokenUsage {
        let promptTokens = 0;
        let completionTokens = 0;
        let totalTokens = 0;

        for (const stats of this.stats.values()) {
            totalTokens += stats.totalTokensUsed;
        }

        return { promptTokens, completionTokens, totalTokens };
    }

    reset(): void {
        this.stats.clear();
    }
}

import { DeploymentStats } from './types';

export class UsageTracker {
    private stats: Map<number, DeploymentStats> = new Map();

    getStats(index: number): DeploymentStats {
        if (!this.stats.has(index)) {
            this.stats.set(index, {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                requestCount: 0,
                failureCount: 0,
                lastUsed: new Date(0),
                cooldownUntil: null,
            });
        }
        return this.stats.get(index);
    }

    recordUsage(index: number, promptTokens: number, completionTokens: number): void {
        const s = this.getStats(index);
        s.promptTokens += promptTokens;
        s.completionTokens += completionTokens;
        s.totalTokens += promptTokens + completionTokens;
        s.requestCount++;
        s.lastUsed = new Date();
    }

    recordFailure(index: number): void {
        const s = this.getStats(index);
        s.failureCount++;
        s.cooldownUntil = new Date(Date.now() + 30000);
    }

    clearCooldown(index: number): void {
        const s = this.getStats(index);
        s.cooldownUntil = null;
    }

    canUse(index: number, rpmLimit?: number, tpmLimit?: number): boolean {
        const s = this.getStats(index);
        if (s.cooldownUntil && s.cooldownUntil > new Date()) {
            return false;
        }
        if (rpmLimit && s.requestCount > 0) {
            const windowStart = new Date(Date.now() - 60000);
            if (s.lastUsed > windowStart && s.requestCount >= rpmLimit) {
                return false;
            }
        }
        if (tpmLimit && s.totalTokens >= tpmLimit) {
            return false;
        }
        return true;
    }

    getLeastUsedIndex(indices: number[]): number {
        let best = indices[0];
        let bestUsage = this.getStats(best).totalTokens;
        for (const idx of indices.slice(1)) {
            const usage = this.getStats(idx).totalTokens;
            if (usage < bestUsage) {
                best = idx;
                bestUsage = usage;
            }
        }
        return best;
    }

    reset(): void {
        this.stats.clear();
    }
}

/**
 * TokenTracker — Stateful, in-memory token usage tracker & load balancer
 *
 * Tracks tokens used per provider within a configurable time window.
 * The SmartRouter calls `selectBestDeployment()` before each request
 * to pick the provider with the least usage that isn't rate-limited.
 */

import { DeploymentState, TokenUsage } from "./types.js";

interface TokenRecord {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    timestamp: number;
}

export class TokenTracker {
    private records: Map<string, TokenRecord[]> = new Map();
    private rateLimits: Map<string, number> = new Map(); // provider → reset timestamp
    private windowMs: number;

    constructor(windowSeconds: number = 60) {
        this.windowMs = windowSeconds * 1000;
    }

    /**
     * Record token usage for a provider after a successful call.
     */
    record(provider: string, usage: TokenUsage): void {
        const records = this.records.get(provider) || [];
        records.push({
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            timestamp: Date.now(),
        });
        this.records.set(provider, records);
    }

    /**
     * Mark a provider as rate-limited until a specific time.
     */
    markRateLimited(provider: string, resetAt: number): void {
        this.rateLimits.set(provider, resetAt);
    }

    /**
     * Clear rate-limit status for a provider.
     */
    clearRateLimit(provider: string): void {
        this.rateLimits.delete(provider);
    }

    /**
     * Check whether a provider is currently rate-limited.
     */
    isRateLimited(provider: string): boolean {
        const resetAt = this.rateLimits.get(provider);
        if (resetAt === undefined) return false;
        if (Date.now() >= resetAt) {
            this.rateLimits.delete(provider);
            return false;
        }
        return true;
    }

    /**
     * Get total tokens used by a provider within the current window.
     */
    getUsage(provider: string): number {
        this.pruneExpired(provider);
        const records = this.records.get(provider) || [];
        return records.reduce((sum, r) => sum + r.totalTokens, 0);
    }

    /**
     * Get a detailed snapshot of usage for all known providers.
     */
    getSnapshot(): Map<string, { totalTokens: number; isRateLimited: boolean }> {
        const snapshot = new Map<string, { totalTokens: number; isRateLimited: boolean }>();
        for (const [provider] of this.records) {
            snapshot.set(provider, {
                totalTokens: this.getUsage(provider),
                isRateLimited: this.isRateLimited(provider),
            });
        }
        return snapshot;
    }

    /**
     * Select the best deployment: not rate-limited + least tokens used.
     * Returns the DeploymentState of the selected provider, or null
     * if all providers are rate-limited.
     */
    selectBestDeployment(deployments: DeploymentState[]): DeploymentState | null {
        // Update token counts and rate-limit status
        const updated = deployments.map((d) => ({
            ...d,
            totalTokensUsed: this.getUsage(d.providerName),
            isRateLimited: this.isRateLimited(d.providerName),
            rateLimitResetAt: this.rateLimits.get(d.providerName) || null,
        }));

        // Filter to available (not rate-limited) providers
        const available = updated.filter((d) => !d.isRateLimited);

        if (available.length === 0) {
            return null;
        }

        // Sort by: lowest tokens used first, then by priority (lower = higher priority)
        available.sort((a, b) => {
            if (a.totalTokensUsed !== b.totalTokensUsed) {
                return a.totalTokensUsed - b.totalTokensUsed;
            }
            return a.priority - b.priority;
        });

        return available[0];
    }

    /**
     * Reset all tracking data. Useful for testing.
     */
    reset(): void {
        this.records.clear();
        this.rateLimits.clear();
    }

    /**
     * Prune records outside the current time window.
     */
    private pruneExpired(provider: string): void {
        const records = this.records.get(provider);
        if (!records) return;
        const cutoff = Date.now() - this.windowMs;
        this.records.set(
            provider,
            records.filter((r) => r.timestamp >= cutoff)
        );
    }
}

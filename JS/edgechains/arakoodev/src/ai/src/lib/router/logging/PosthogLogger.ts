import type { CallLogEntry } from "../types.js";
import type { Logger } from "./CallbackManager.js";

/**
 * Logs API call metrics to PostHog.
 *
 * Requires `posthog-node` to be installed as a peer dependency.
 * Falls back silently if PostHog is not available.
 */
export class PosthogLogger implements Logger {
    private client: any;

    constructor(apiKey: string, host?: string) {
        try {
            const { PostHog } = require("posthog-node");
            this.client = new PostHog(apiKey, { host: host || "https://app.posthog.com" });
        } catch {
            this.client = null;
        }
    }

    log(entry: CallLogEntry): void {
        if (!this.client) return;

        this.client.capture({
            distinctId: "edgechains-router",
            event: "ai_api_call",
            properties: {
                provider: entry.provider,
                model: entry.model,
                deployment: entry.deployment,
                success: entry.success,
                latency_ms: entry.latencyMs,
                prompt_tokens: entry.usage.promptTokens,
                completion_tokens: entry.usage.completionTokens,
                total_tokens: entry.usage.totalTokens,
                error: entry.error,
            },
        });
    }
}

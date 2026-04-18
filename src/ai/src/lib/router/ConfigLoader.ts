/**
 * ConfigLoader — Loads SmartRouter configuration from Jsonnet files
 *
 * Uses @arakoodev/jsonnet to parse .jsonnet configuration files
 * and maps the result to a typed SmartRouterConfig object.
 */

import { SmartRouterConfig, ProviderConfig, RetryConfig } from "./types.js";

/**
 * Parse a raw JSON object (from Jsonnet evaluation) into a typed SmartRouterConfig.
 * This does not depend on @arakoodev/jsonnet directly so the module
 * stays testable without the WASM dependency.
 */
export function parseRouterConfig(rawJson: Record<string, any>): SmartRouterConfig {
    const providers: ProviderConfig[] = (rawJson.providers || []).map((p: any) => ({
        name: p.name,
        priority: p.priority ?? 99,
        models: p.models || [],
        apiKeyEnv: p.apiKeyEnv || "",
        apiKey: p.apiKey || undefined,
        maxTokensPerMinute: p.maxTokensPerMinute ?? 60000,
        timeout: p.timeout ?? 30000,
        orgId: p.orgId || undefined,
    }));

    const retry: RetryConfig = {
        maxAttempts: rawJson.retry?.maxAttempts ?? 3,
        backoffMs: rawJson.retry?.backoffMs ?? 200,
    };

    return {
        providers,
        fallbackOrder: rawJson.fallbackOrder || providers.map((p: ProviderConfig) => p.name),
        retry,
        tokenWindowSeconds: rawJson.tokenWindowSeconds ?? 60,
        observability: rawJson.observability || undefined,
    };
}

/**
 * Load a SmartRouter configuration from a Jsonnet file path.
 *
 * Requires @arakoodev/jsonnet to be available. If running in an environment
 * where jsonnet is not available, use `parseRouterConfig()` with a pre-parsed
 * JSON object instead.
 */
export function loadRouterConfig(jsonnetFilePath: string): SmartRouterConfig {
    // Dynamic import to avoid hard dependency on WASM module at compile time
    let Jsonnet: any;
    try {
        Jsonnet = require("@arakoodev/jsonnet");
    } catch {
        throw new Error(
            "loadRouterConfig requires @arakoodev/jsonnet. " +
                "Install it or use parseRouterConfig() with a pre-parsed JSON object."
        );
    }

    const jsonnet = new Jsonnet();
    const raw = JSON.parse(jsonnet.evaluateFile(jsonnetFilePath));
    return parseRouterConfig(raw);
}

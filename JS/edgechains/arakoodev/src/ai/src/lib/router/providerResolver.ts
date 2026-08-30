import { ProviderName } from "./types.js";

/**
 * Result of resolving a fully-qualified model string into a provider and
 * the canonical model id that should be forwarded to that provider.
 */
export interface ResolvedModel {
    provider: ProviderName;
    model: string;
}

/**
 * Ordered list of model-prefix -> provider rules. Order matters because
 * the first matching rule wins; more specific prefixes therefore appear
 * before more general ones.
 */
const PROVIDER_PREFIXES: Array<{ prefix: string; provider: ProviderName }> = [
    { prefix: "gpt-", provider: "openai" },
    { prefix: "o1-", provider: "openai" },
    { prefix: "o3-", provider: "openai" },
    { prefix: "text-embedding-", provider: "openai" },
    { prefix: "claude-", provider: "anthropic" },
    { prefix: "gemini-", provider: "google" },
    { prefix: "models/gemini-", provider: "google" },
    { prefix: "command-", provider: "cohere" },
    { prefix: "command", provider: "cohere" },
    { prefix: "llama-", provider: "llama" },
    { prefix: "llama3-", provider: "llama" },
    { prefix: "llama2-", provider: "llama" },
];

const EXPLICIT_PROVIDERS = new Set<ProviderName>([
    "openai",
    "anthropic",
    "google",
    "cohere",
    "llama",
]);

/**
 * Resolve a model string to a {@link ResolvedModel}.
 *
 * Two forms are accepted:
 *   1. ``<provider>/<model>`` — explicit provider, the segment after the
 *      slash is forwarded verbatim.
 *   2. Bare model id — provider is inferred from {@link PROVIDER_PREFIXES}.
 *
 * Unknown models resolve to ``{ provider: "unknown", model }`` so callers
 * can decide whether to throw or fall through to a default provider.
 */
export function resolveProvider(model: string): ResolvedModel {
    if (!model || typeof model !== "string") {
        return { provider: "unknown", model: String(model ?? "") };
    }

    const trimmed = model.trim();

    // 1) Explicit "<provider>/<model>" form.
    const slashIdx = trimmed.indexOf("/");
    if (slashIdx > 0) {
        const head = trimmed.slice(0, slashIdx).toLowerCase() as ProviderName;
        const tail = trimmed.slice(slashIdx + 1);
        if (EXPLICIT_PROVIDERS.has(head) && tail.length > 0) {
            return { provider: head, model: tail };
        }
    }

    // 2) Prefix-based inference.
    const lower = trimmed.toLowerCase();
    for (const { prefix, provider } of PROVIDER_PREFIXES) {
        if (lower.startsWith(prefix)) {
            return { provider, model: trimmed };
        }
    }

    return { provider: "unknown", model: trimmed };
}

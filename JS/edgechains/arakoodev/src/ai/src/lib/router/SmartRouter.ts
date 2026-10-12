import {
    ProviderAdapter,
    ProviderKeys,
    ProviderName,
    RouterRequest,
    RouterResponse,
} from "./types.js";
import { resolveProvider } from "./providerResolver.js";
import { OpenAIAdapter } from "./adapters/openaiAdapter.js";
import { AnthropicAdapter } from "./adapters/anthropicAdapter.js";
import { GoogleAdapter } from "./adapters/googleAdapter.js";
import { CohereAdapter } from "./adapters/cohereAdapter.js";

export interface SmartRouterOptions extends ProviderKeys {
    /**
     * Optional provider used when the model prefix cannot be resolved.
     * If unset, requests with unknown models throw ``RouterError``.
     */
    defaultProvider?: ProviderName;
    /**
     * OpenAI organization id (forwarded to the OpenAI adapter only).
     */
    openaiOrgId?: string;
    /**
     * Inject pre-built adapters (useful for tests / custom providers).
     * Keys here take precedence over the auto-built adapters.
     */
    adapters?: Partial<Record<ProviderName, ProviderAdapter>>;
}

/**
 * Error thrown for router-level failures (unknown provider, missing key,
 * upstream HTTP error). The original cause is preserved on ``.cause``
 * so callers can introspect provider-specific error responses.
 */
export class RouterError extends Error {
    public readonly provider: ProviderName;
    public readonly status?: number;
    public readonly cause?: unknown;

    constructor(
        message: string,
        opts: { provider: ProviderName; status?: number; cause?: unknown } = {
            provider: "unknown",
        }
    ) {
        super(message);
        this.name = "RouterError";
        this.provider = opts.provider;
        this.status = opts.status;
        this.cause = opts.cause;
    }
}

/**
 * Unified, provider-agnostic router for LLM chat completions.
 *
 * ``SmartRouter`` accepts a normalized {@link RouterRequest}, dispatches
 * it to the appropriate provider (inferred from ``request.model`` or
 * forced via the ``"provider/model"`` syntax), and returns a normalized
 * {@link RouterResponse}. The goal is to mirror the ergonomics of
 * Python's ``litellm`` package in TypeScript.
 *
 * ```ts
 * const router = new SmartRouter({
 *   openai: process.env.OPENAI_API_KEY,
 *   anthropic: process.env.ANTHROPIC_API_KEY,
 * });
 *
 * const res = await router.complete({
 *   model: "gpt-4o",
 *   messages: [{ role: "user", content: "Say hi" }],
 * });
 *
 * console.log(res.content, res.provider, res.usage);
 * ```
 */
export class SmartRouter {
    private readonly adapters = new Map<ProviderName, ProviderAdapter>();
    private readonly defaultProvider?: ProviderName;

    constructor(options: SmartRouterOptions = {}) {
        this.defaultProvider = options.defaultProvider;

        // Auto-build adapters for every provider whose key is present.
        const openaiKey = options.openai ?? process.env.OPENAI_API_KEY;
        if (openaiKey) {
            this.adapters.set(
                "openai",
                new OpenAIAdapter({ apiKey: openaiKey, orgId: options.openaiOrgId })
            );
        }
        const anthropicKey = options.anthropic ?? process.env.ANTHROPIC_API_KEY;
        if (anthropicKey) {
            this.adapters.set("anthropic", new AnthropicAdapter({ apiKey: anthropicKey }));
        }
        const googleKey =
            options.google ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
        if (googleKey) {
            this.adapters.set("google", new GoogleAdapter({ apiKey: googleKey }));
        }
        const cohereKey = options.cohere ?? process.env.COHERE_API_KEY;
        if (cohereKey) {
            this.adapters.set("cohere", new CohereAdapter({ apiKey: cohereKey }));
        }

        // Caller-provided adapters win, e.g. for tests or for ``llama``
        // (which has no built-in adapter in this MVP yet).
        if (options.adapters) {
            for (const [name, adapter] of Object.entries(options.adapters)) {
                if (adapter) this.adapters.set(name as ProviderName, adapter);
            }
        }
    }

    /**
     * Register (or replace) an adapter for a given provider at runtime.
     * Useful for plugging in custom providers (e.g. a local Ollama
     * server) without forking the router.
     */
    register(provider: ProviderName, adapter: ProviderAdapter): void {
        this.adapters.set(provider, adapter);
    }

    /** Return ``true`` if an adapter is registered for ``provider``. */
    supports(provider: ProviderName): boolean {
        return this.adapters.has(provider);
    }

    /** List every provider currently routable from this instance. */
    listProviders(): ProviderName[] {
        return Array.from(this.adapters.keys());
    }

    /**
     * Run a chat completion request. Throws {@link RouterError} when
     * the provider cannot be resolved, no adapter is registered for the
     * resolved provider, or the upstream call fails.
     */
    async complete(req: RouterRequest): Promise<RouterResponse> {
        if (!req || !req.model) {
            throw new RouterError("RouterRequest.model is required", { provider: "unknown" });
        }
        if (!Array.isArray(req.messages) || req.messages.length === 0) {
            throw new RouterError("RouterRequest.messages must be a non-empty array", {
                provider: "unknown",
            });
        }

        let { provider, model } = resolveProvider(req.model);
        if (provider === "unknown") {
            if (this.defaultProvider && this.adapters.has(this.defaultProvider)) {
                provider = this.defaultProvider;
            } else {
                throw new RouterError(
                    `Unable to route model "${req.model}". Use "provider/model" or register an adapter.`,
                    { provider: "unknown" }
                );
            }
        }

        const adapter = this.adapters.get(provider);
        if (!adapter) {
            throw new RouterError(
                `No adapter registered for provider "${provider}". Did you pass the API key?`,
                { provider }
            );
        }

        try {
            return await adapter.complete({ ...req, model });
        } catch (err: any) {
            // Re-throw RouterErrors verbatim.
            if (err instanceof RouterError) throw err;
            const status = err?.response?.status;
            const message =
                err?.response?.data?.error?.message ||
                err?.message ||
                `Provider "${provider}" request failed`;
            throw new RouterError(message, { provider, status, cause: err });
        }
    }
}

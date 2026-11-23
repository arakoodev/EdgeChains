import { ComprehendRedactor, RedactOptions } from "./comprehend.js";

/**
 * Minimal structural shape of an EdgeChains chat `Endpoint` (e.g. `OpenAI`,
 * `GeminiAI`, `LlamaAI`). Any object exposing a `chat(options)` method that
 * accepts a `{ prompt?: string; messages?: ... }`-style options bag and returns
 * a promise can be wrapped by {@link RedactorChain}.
 *
 * The generics keep the wrapped endpoint's concrete `chat` signature intact so
 * TypeScript callers keep full type-safety and autocomplete after chaining.
 */
export interface ChatEndpointLike {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chat(options: any): Promise<any>;
}

/** Options accepted by {@link RedactorChain} and {@link redactPrompt}. */
export interface RedactorChainOptions {
    /** Options forwarded to {@link ComprehendRedactor.redact} for every prompt. */
    redactOptions?: RedactOptions;
    /**
     * Also redact the textual content of the endpoint's response before it is
     * returned to the caller. Defaults to `false`.
     */
    redactResponse?: boolean;
}

/**
 * Recursively redact every string value found under `prompt` / `messages`
 * (and `content`) keys of an endpoint options bag, leaving all other fields
 * untouched. Returns a shallow-cloned options object so the caller's original
 * object is never mutated.
 */
async function redactOptionsBag(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any,
    redactor: ComprehendRedactor,
    redactOptions: RedactOptions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
    if (!options || typeof options !== "object") {
        return options;
    }

    const clone: Record<string, unknown> = { ...options };

    if (typeof clone.prompt === "string") {
        const { redactedText } = await redactor.redact(clone.prompt, redactOptions);
        clone.prompt = redactedText;
    }

    if (Array.isArray(clone.messages)) {
        clone.messages = await Promise.all(
            clone.messages.map(async (message: unknown) => {
                if (message && typeof message === "object") {
                    const msg = message as Record<string, unknown>;
                    if (typeof msg.content === "string") {
                        const { redactedText } = await redactor.redact(msg.content, redactOptions);
                        return { ...msg, content: redactedText };
                    }
                }
                return message;
            })
        );
    }

    return clone;
}

/**
 * Recursively redact string content fields (`content`, `text`) of an endpoint
 * response. Handles the common `{ content: string }` shape returned by the
 * EdgeChains `OpenAI`/`GeminiAI`/`LlamaAI` `chat` methods as well as arrays of
 * such objects.
 */
async function redactResponsePayload(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any,
    redactor: ComprehendRedactor,
    redactOptions: RedactOptions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
    if (payload == null) {
        return payload;
    }

    if (typeof payload === "string") {
        const { redactedText } = await redactor.redact(payload, redactOptions);
        return redactedText;
    }

    if (Array.isArray(payload)) {
        return Promise.all(
            payload.map((item) => redactResponsePayload(item, redactor, redactOptions))
        );
    }

    if (typeof payload === "object") {
        const clone: Record<string, unknown> = { ...payload };
        for (const key of ["content", "text"] as const) {
            if (typeof clone[key] === "string") {
                const { redactedText } = await redactor.redact(
                    clone[key] as string,
                    redactOptions
                );
                clone[key] = redactedText;
            }
        }
        return clone;
    }

    return payload;
}

/**
 * `RedactorChain` makes the {@link ComprehendRedactor} **chainable** with the
 * existing EdgeChains `Endpoint` classes (as observables / middleware).
 *
 * Wrap any endpoint and every prompt sent through `chat()` is scrubbed of PII
 * *before* it reaches the underlying LLM provider:
 *
 * ```ts
 * const redactor = new ComprehendRedactor({ region: "us-east-1" });
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *
 * // Chain the redactor in front of the OpenAI endpoint.
 * const safe = RedactorChain.wrap(openai, redactor);
 *
 * // The prompt is redacted before OpenAI ever sees it.
 * const response = await safe.chat({
 *     prompt: "My SSN is 123-45-6789, summarize my profile.",
 * });
 * ```
 *
 * The wrapper preserves the wrapped endpoint's `chat` signature via generics,
 * so callers keep full type-safety. It also forwards any other properties /
 * methods of the original endpoint (e.g. `streamedChat`, `generateEmbeddings`)
 * by delegating through a `Proxy`, so the returned object is a drop-in
 * replacement for the original endpoint.
 */
export class RedactorChain<T extends ChatEndpointLike> {
    private constructor(
        private readonly endpoint: T,
        private readonly redactor: ComprehendRedactor,
        private readonly options: RedactorChainOptions
    ) {}

    /**
     * Wrap `endpoint` so that every `chat()` call redacts its prompt (and,
     * optionally, its response) with `redactor`.
     */
    static wrap<T extends ChatEndpointLike>(
        endpoint: T,
        redactor: ComprehendRedactor,
        options: RedactorChainOptions = {}
    ): T {
        const chain = new RedactorChain(endpoint, redactor, options);

        // Intercept `chat` while delegating every other property/method to the
        // original endpoint, so the wrapper is a transparent drop-in.
        return new Proxy(endpoint, {
            get(target, prop, receiver) {
                if (prop === "chat") {
                    return chain.redactedChat.bind(chain);
                }
                const value = Reflect.get(target, prop, receiver);
                return typeof value === "function" ? value.bind(target) : value;
            },
        }) as T;
    }

    /**
     * A `chat` implementation that redacts the incoming prompt (and optionally
     * the outgoing response) before/after delegating to the wrapped endpoint.
     */
    async redactedChat(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chatOptions: any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> {
        const redactOptions = this.options.redactOptions ?? {};
        const safeOptions = await redactOptionsBag(chatOptions, this.redactor, redactOptions);

        const response = await this.endpoint.chat(safeOptions);

        if (this.options.redactResponse) {
            return redactResponsePayload(response, this.redactor, redactOptions);
        }
        return response;
    }
}

/**
 * Functional helper equivalent to `RedactorChain.wrap(endpoint, redactor, options)`.
 * Provided for callers who prefer a one-liner.
 */
export function redactPrompt<T extends ChatEndpointLike>(
    endpoint: T,
    redactor: ComprehendRedactor,
    options: RedactorChainOptions = {}
): T {
    return RedactorChain.wrap(endpoint, redactor, options);
}
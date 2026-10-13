import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
} from "@aws-sdk/client-comprehend";
import type {
    AWSComprehendPiiRedactorOptions,
    ChatEndpoint,
    ChatOptionsLike,
    ComprehendLikeClient,
    DetectedPiiEntity,
    PiiReplacementStyle,
    RedactObservable,
    RedactObserver,
    RedactSubscription,
} from "./types.js";

function codePoints(text: string): string[] {
    return Array.from(text);
}

function fromCodePoints(points: string[]): string {
    return points.join("");
}

/**
 * AWS Comprehend offsets are Unicode code-point positions in the input text.
 */
function replaceByCodePointOffsets(
    text: string,
    begin: number,
    end: number,
    replacement: string
): string {
    const points = codePoints(text);
    if (begin < 0 || end < begin || begin > points.length) {
        return text;
    }
    const safeEnd = Math.min(end, points.length);
    return fromCodePoints([
        ...points.slice(0, begin),
        ...codePoints(replacement),
        ...points.slice(safeEnd),
    ]);
}

function sliceByCodePointOffsets(text: string, begin: number, end: number): string {
    return fromCodePoints(codePoints(text).slice(begin, end));
}

function defaultPlaceholder(type: string): string {
    return `[REDACTED_${type}]`;
}

/**
 * Redacts PII in prompts via Amazon Comprehend `DetectPiiEntities`, and can be
 * chained with existing Endpoint classes (e.g. `OpenAI.chat`) before LLM calls.
 *
 * Observable-style chaining is provided via `redact$` without forcing RxJS onto
 * the SDK (the rest of EdgeChains uses Promise + axios, not RxJS).
 */
export class AWSComprehendPiiRedactor {
    private readonly client: ComprehendLikeClient;
    private readonly languageCode: string;
    private readonly minScore: number;
    private readonly entityTypes?: Set<string>;
    private readonly replacement: PiiReplacementStyle;
    private readonly maskCharacter: string;
    private readonly placeholder: (type: string) => string;
    private readonly failClosed: boolean;

    constructor(opts: AWSComprehendPiiRedactorOptions = {}) {
        this.languageCode = opts.languageCode || "en";
        this.minScore = opts.minScore ?? 0.5;
        this.entityTypes = opts.entityTypes ? new Set(opts.entityTypes) : undefined;
        this.replacement = opts.replacement || "entityType";
        this.maskCharacter = opts.maskCharacter || "*";
        this.placeholder = opts.placeholder || defaultPlaceholder;
        this.failClosed = opts.failClosed ?? true;

        if (opts.client) {
            this.client = opts.client;
        } else {
            const config: ConstructorParameters<typeof ComprehendClient>[0] = {
                region: opts.region || process.env.AWS_REGION || "us-east-1",
            };
            if (opts.accessKeyId && opts.secretAccessKey) {
                config.credentials = {
                    accessKeyId: opts.accessKeyId,
                    secretAccessKey: opts.secretAccessKey,
                    ...(opts.sessionToken ? { sessionToken: opts.sessionToken } : {}),
                };
            }
            this.client = new ComprehendClient(config) as ComprehendLikeClient;
        }
    }

    async detectPii(text: string): Promise<DetectedPiiEntity[]> {
        if (!text) {
            return [];
        }
        try {
            const out = await this.client.send(
                new DetectPiiEntitiesCommand({
                    Text: text,
                    LanguageCode: this.languageCode as import("@aws-sdk/client-comprehend").LanguageCode,
                })
            );
            return (out.Entities || []).filter((entity) => {
                if (entity.BeginOffset == null || entity.EndOffset == null) {
                    return false;
                }
                if (entity.EndOffset < entity.BeginOffset) {
                    return false;
                }
                if ((entity.Score ?? 0) < this.minScore) {
                    return false;
                }
                if (this.entityTypes && entity.Type && !this.entityTypes.has(entity.Type)) {
                    return false;
                }
                return true;
            });
        } catch (err) {
            if (this.failClosed) {
                throw err;
            }
            return [];
        }
    }

    private formatReplacement(entity: DetectedPiiEntity, original: string): string {
        const type = entity.Type || "PII";
        switch (this.replacement) {
            case "mask":
                return this.maskCharacter.repeat(Math.max(original.length, 1));
            case "placeholder":
                return this.placeholder(type);
            case "entityType":
            default:
                return `[${type}]`;
        }
    }

    async redact(text: string): Promise<string> {
        if (!text) {
            return text;
        }
        const entities = await this.detectPii(text);
        if (entities.length === 0) {
            return text;
        }
        // Descending BeginOffset so earlier replacements do not shift later offsets.
        const sorted = [...entities].sort(
            (a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0)
        );
        let result = text;
        for (const entity of sorted) {
            const begin = entity.BeginOffset!;
            const end = entity.EndOffset!;
            const original = sliceByCodePointOffsets(result, begin, end);
            const repl = this.formatReplacement(entity, original);
            result = replaceByCodePointOffsets(result, begin, end, repl);
        }
        return result;
    }

    async redactChatOptions<T extends ChatOptionsLike>(opts: T): Promise<T> {
        const next: ChatOptionsLike = { ...opts };
        if (typeof opts.prompt === "string") {
            next.prompt = await this.redact(opts.prompt);
        }
        if (Array.isArray(opts.messages)) {
            next.messages = await Promise.all(
                opts.messages.map(async (message) => {
                    if (typeof message.content !== "string") {
                        return message;
                    }
                    return {
                        ...message,
                        content: await this.redact(message.content),
                    };
                })
            );
        }
        return next as T;
    }

    async chain<T>(text: string, next: (redacted: string) => Promise<T> | T): Promise<T> {
        return next(await this.redact(text));
    }

    /**
     * Returns a shallow wrapper whose `chat` redacts `prompt` / `messages` first.
     * Compatible with OpenAI and any Endpoint exposing `chat(opts)`.
     */
    wrapEndpoint<E extends ChatEndpoint>(endpoint: E): E {
        const self = this;
        return {
            ...endpoint,
            chat: async (opts: ChatOptionsLike) => {
                const safe = await self.redactChatOptions(opts);
                return endpoint.chat(safe);
            },
        } as E;
    }

    /**
     * Minimal Observable-compatible API (no RxJS dependency).
     * Satisfies the bounty wording "as observables" while staying dependency-light.
     */
    redact$(text: string): RedactObservable {
        const self = this;
        return {
            subscribe(
                observerOrNext: RedactObserver | ((value: string) => void)
            ): RedactSubscription {
                const observer: RedactObserver =
                    typeof observerOrNext === "function"
                        ? { next: observerOrNext }
                        : observerOrNext;
                let cancelled = false;
                self.redact(text)
                    .then((value) => {
                        if (cancelled) {
                            return;
                        }
                        observer.next?.(value);
                        observer.complete?.();
                    })
                    .catch((err) => {
                        if (!cancelled) {
                            observer.error?.(err);
                        }
                    });
                return {
                    unsubscribe() {
                        cancelled = true;
                    },
                };
            },
        };
    }
}

export type {
    AWSComprehendPiiRedactorOptions,
    ChatEndpoint,
    ChatOptionsLike,
    ComprehendLikeClient,
    DetectedPiiEntity,
    PiiReplacementStyle,
    RedactObservable,
};

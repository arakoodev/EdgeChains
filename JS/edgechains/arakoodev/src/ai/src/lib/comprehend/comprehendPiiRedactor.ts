import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";
import { Buffer } from "node:buffer";
import { Observable, concatMap, type OperatorFunction } from "rxjs";

export type PiiLanguageCode = "en" | "es";

export interface ComprehendRequestOptions {
    abortSignal?: AbortSignal;
}

export interface DetectPiiEntitiesResult {
    Entities?: PiiEntity[];
}

export interface ComprehendClientLike {
    send(
        command: DetectPiiEntitiesCommand,
        options?: ComprehendRequestOptions
    ): Promise<DetectPiiEntitiesResult>;
}

export interface RedactableMessage {
    content?: string;
    [key: string]: unknown;
}

export interface RedactableChatOptions {
    prompt?: string;
    messages?: RedactableMessage[];
    [key: string]: unknown;
}

export interface ChatEndpoint<
    TOptions extends RedactableChatOptions = RedactableChatOptions,
    TResult = unknown,
> {
    chat(options: TOptions): Promise<TResult>;
}

export type RedactableValue = string | RedactableChatOptions;

export type RedactionReplacement =
    | "entityType"
    | "mask"
    | ((entity: PiiEntity, originalValue: string) => string);

export interface ComprehendPiiRedactorOptions {
    client?: ComprehendClientLike;
    region?: string;
    languageCode?: PiiLanguageCode;
    minScore?: number;
    entityTypes?: readonly string[];
    replacement?: RedactionReplacement;
    maskCharacter?: string;
    maxUtf8Bytes?: number;
}

export interface RedactionResult {
    text: string;
    entities: PiiEntity[];
}

const DEFAULT_MAX_UTF8_BYTES = 100 * 1024;

/**
 * Redacts PII detected by Amazon Comprehend before a prompt reaches an LLM endpoint.
 *
 * Amazon Comprehend offsets are Unicode code-point offsets. JavaScript string slicing
 * uses UTF-16 code units, so replacements are applied to an Array.from(text) view to
 * keep offsets correct when emoji or other supplementary characters appear first.
 */
export class ComprehendPiiRedactor {
    private readonly client: ComprehendClientLike;
    private readonly languageCode: PiiLanguageCode;
    private readonly minScore: number;
    private readonly entityTypes?: Set<string>;
    private readonly replacement: RedactionReplacement;
    private readonly maskCharacter: string;
    private readonly maxUtf8Bytes: number;

    constructor(options: ComprehendPiiRedactorOptions = {}) {
        const minScore = options.minScore ?? 0;
        if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) {
            throw new RangeError("minScore must be between 0 and 1");
        }

        const maskCharacter = options.maskCharacter ?? "*";
        if (Array.from(maskCharacter).length !== 1) {
            throw new RangeError(
                "maskCharacter must contain exactly one Unicode code point"
            );
        }

        const maxUtf8Bytes = options.maxUtf8Bytes ?? DEFAULT_MAX_UTF8_BYTES;
        if (!Number.isInteger(maxUtf8Bytes) || maxUtf8Bytes < 1) {
            throw new RangeError("maxUtf8Bytes must be a positive integer");
        }

        this.client =
            options.client ?? new ComprehendClient({ region: options.region });
        this.languageCode = options.languageCode ?? "en";
        this.minScore = minScore;
        this.entityTypes = options.entityTypes
            ? new Set(options.entityTypes)
            : undefined;
        this.replacement = options.replacement ?? "entityType";
        this.maskCharacter = maskCharacter;
        this.maxUtf8Bytes = maxUtf8Bytes;
    }

    async detect(
        text: string,
        requestOptions: ComprehendRequestOptions = {}
    ): Promise<PiiEntity[]> {
        if (!text) {
            return [];
        }

        this.validateTextSize(text);

        const output = await this.client.send(
            new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: this.languageCode,
            }),
            requestOptions.abortSignal
                ? { abortSignal: requestOptions.abortSignal }
                : undefined
        );

        const codePointLength = Array.from(text).length;
        return (output.Entities ?? []).filter((entity) =>
            this.isRedactableEntity(entity, codePointLength)
        );
    }

    async redact(
        text: string,
        requestOptions: ComprehendRequestOptions = {}
    ): Promise<string> {
        return (await this.redactWithEntities(text, requestOptions)).text;
    }

    async redactWithEntities(
        text: string,
        requestOptions: ComprehendRequestOptions = {}
    ): Promise<RedactionResult> {
        if (!text) {
            return { text, entities: [] };
        }

        const entities = this.selectNonOverlappingEntities(
            await this.detect(text, requestOptions)
        );
        const codePoints = Array.from(text);

        for (const entity of entities) {
            const begin = entity.BeginOffset as number;
            const end = entity.EndOffset as number;
            const originalValue = codePoints.slice(begin, end).join("");
            const replacement = this.createReplacement(entity, originalValue);
            codePoints.splice(begin, end - begin, ...Array.from(replacement));
        }

        return {
            text: codePoints.join(""),
            entities: [...entities].sort(
                (a, b) => (a.BeginOffset as number) - (b.BeginOffset as number)
            ),
        };
    }

    async redactChatOptions<T extends RedactableChatOptions>(
        chatOptions: T,
        requestOptions: ComprehendRequestOptions = {}
    ): Promise<T> {
        const [prompt, messages] = await Promise.all([
            typeof chatOptions.prompt === "string"
                ? this.redact(chatOptions.prompt, requestOptions)
                : Promise.resolve(chatOptions.prompt),
            Array.isArray(chatOptions.messages)
                ? Promise.all(
                      chatOptions.messages.map(async (message) => ({
                          ...message,
                          content:
                              typeof message.content === "string"
                                  ? await this.redact(
                                        message.content,
                                        requestOptions
                                    )
                                  : message.content,
                      }))
                  )
                : Promise.resolve(chatOptions.messages),
        ]);

        return {
            ...chatOptions,
            prompt,
            messages,
        } as T;
    }

    redact$(text: string): Observable<string> {
        return this.cancellableObservable((abortSignal) =>
            this.redact(text, { abortSignal })
        );
    }

    redactChatOptions$<T extends RedactableChatOptions>(
        chatOptions: T
    ): Observable<T> {
        return this.cancellableObservable((abortSignal) =>
            this.redactChatOptions(chatOptions, { abortSignal })
        );
    }

    /**
     * Returns a real RxJS operator. concatMap preserves input order and waits for each
     * Comprehend request before allowing the source Observable to complete.
     */
    redactOperator<T extends RedactableValue>(): OperatorFunction<T, T> {
        return (source) =>
            source.pipe(
                concatMap((value) =>
                    this.cancellableObservable((abortSignal) =>
                        this.redactValue(value, { abortSignal })
                    )
                )
            );
    }

    /**
     * Redacts endpoint options and invokes the endpoint as one Observable pipeline step.
     */
    endpointOperator<TOptions extends RedactableChatOptions, TResult>(
        endpoint: ChatEndpoint<TOptions, TResult>
    ): OperatorFunction<TOptions, TResult> {
        return (source) =>
            source.pipe(
                concatMap((options) =>
                    this.redactChatOptions$(options).pipe(
                        concatMap((redactedOptions) =>
                            endpoint.chat.call(endpoint, redactedOptions)
                        )
                    )
                )
            );
    }

    wrapEndpoint<TOptions extends RedactableChatOptions, TResult>(
        endpoint: ChatEndpoint<TOptions, TResult>
    ): ChatEndpoint<TOptions, TResult> {
        return {
            chat: async (options: TOptions) =>
                endpoint.chat.call(
                    endpoint,
                    await this.redactChatOptions(options)
                ),
        };
    }

    private async redactValue<T extends RedactableValue>(
        value: T,
        requestOptions: ComprehendRequestOptions
    ): Promise<T> {
        if (typeof value === "string") {
            return (await this.redact(value, requestOptions)) as T;
        }

        return this.redactChatOptions(value, requestOptions) as Promise<T>;
    }

    private validateTextSize(text: string): void {
        const byteLength = Buffer.byteLength(text, "utf8");
        if (byteLength > this.maxUtf8Bytes) {
            throw new RangeError(
                `Amazon Comprehend DetectPiiEntities accepts at most ${this.maxUtf8Bytes} UTF-8 bytes; received ${byteLength}`
            );
        }
    }

    private isRedactableEntity(
        entity: PiiEntity,
        codePointLength: number
    ): boolean {
        const begin = entity.BeginOffset;
        const end = entity.EndOffset;

        if (
            !Number.isInteger(begin) ||
            !Number.isInteger(end) ||
            (begin as number) < 0 ||
            (end as number) <= (begin as number) ||
            (end as number) > codePointLength
        ) {
            return false;
        }

        if ((entity.Score ?? 0) < this.minScore) {
            return false;
        }

        if (
            this.entityTypes &&
            (!entity.Type || !this.entityTypes.has(entity.Type))
        ) {
            return false;
        }

        return true;
    }

    private selectNonOverlappingEntities(entities: PiiEntity[]): PiiEntity[] {
        const candidates = [...entities].sort((a, b) => {
            const scoreDifference = (b.Score ?? 0) - (a.Score ?? 0);
            if (scoreDifference !== 0) {
                return scoreDifference;
            }

            const aLength = (a.EndOffset as number) - (a.BeginOffset as number);
            const bLength = (b.EndOffset as number) - (b.BeginOffset as number);
            if (aLength !== bLength) {
                return bLength - aLength;
            }

            return (a.BeginOffset as number) - (b.BeginOffset as number);
        });

        const selected: PiiEntity[] = [];
        for (const candidate of candidates) {
            const begin = candidate.BeginOffset as number;
            const end = candidate.EndOffset as number;
            const overlaps = selected.some((entity) => {
                const selectedBegin = entity.BeginOffset as number;
                const selectedEnd = entity.EndOffset as number;
                return begin < selectedEnd && end > selectedBegin;
            });

            if (!overlaps) {
                selected.push(candidate);
            }
        }

        return selected.sort(
            (a, b) => (b.BeginOffset as number) - (a.BeginOffset as number)
        );
    }

    private createReplacement(
        entity: PiiEntity,
        originalValue: string
    ): string {
        if (typeof this.replacement === "function") {
            return this.replacement(entity, originalValue);
        }

        if (this.replacement === "mask") {
            return this.maskCharacter.repeat(Array.from(originalValue).length);
        }

        return `[${entity.Type ?? "PII"}]`;
    }

    private cancellableObservable<T>(
        work: (abortSignal: AbortSignal) => Promise<T>
    ): Observable<T> {
        return new Observable<T>((subscriber) => {
            const controller = new AbortController();
            let settled = false;

            work(controller.signal).then(
                (value) => {
                    settled = true;
                    if (!subscriber.closed) {
                        subscriber.next(value);
                        subscriber.complete();
                    }
                },
                (error) => {
                    settled = true;
                    if (!subscriber.closed) {
                        subscriber.error(error);
                    }
                }
            );

            return () => {
                if (!settled) {
                    controller.abort();
                }
            };
        });
    }
}

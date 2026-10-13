import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type LanguageCode,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";

/**
 * Amazon Comprehend redaction modes from the PII detection/redaction APIs.
 * @see https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/
 */
export type MaskMode = "REPLACE_WITH_PII_ENTITY_TYPE" | "MASK";

export type ComprehendClientLike = {
    send: (command: unknown, ...rest: unknown[]) => Promise<unknown>;
};

export type RedactionReplacement = string | ((entity: PiiEntity, original: string) => string);

/** Synchronous DetectPiiEntities accepts at most 100 KB of UTF-8 text. */
export const DETECT_PII_ENTITIES_MAX_UTF8_BYTES = 100 * 1024;

export interface Utf8TextChunk {
    codePointOffset: number;
    text: string;
}

export interface AWSComprehendOptions {
    accessKeyId?: string;
    client?: ComprehendClientLike;
    entityTypes?: string[];
    languageCode?: LanguageCode | string;
    maskCharacter?: string;
    maskMode?: MaskMode;
    /**
     * Maximum UTF-8 bytes sent in one DetectPiiEntities call.
     * Defaults to Amazon Comprehend's 100 KB synchronous limit; longer prompts
     * are split on code-point boundaries (preferring whitespace) and offsets
     * are rebased onto the original text.
     */
    maxUtf8Bytes?: number;
    minScore?: number;
    region?: string;
    replacement?: RedactionReplacement;
    secretAccessKey?: string;
    sessionToken?: string;
}

export interface RedactPiiOptions {
    entityTypes?: string[];
    languageCode?: LanguageCode | string;
    maskCharacter?: string;
    maskMode?: MaskMode;
    minScore?: number;
    replacement?: RedactionReplacement;
    text: string;
}

export interface RedactPiiResult {
    entities: PiiEntity[];
    redactedText: string;
    text: string;
}

export interface RedactableMessage {
    content?: string;
    role?: string;
    [key: string]: unknown;
}

export interface RedactablePromptOptions {
    input?: string | string[];
    messages?: RedactableMessage[];
    prompt?: string;
    [key: string]: unknown;
}

const CHAINABLE_ENDPOINT_METHODS = new Set([
    "chat",
    "chatWithFunction",
    "embeddings",
    "generateEmbeddings",
    "gptFn",
    "gptFnChat",
    "streamedChat",
    "zodSchemaResponse",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function utf8BytesForCodePoint(codePoint: number): number {
    if (codePoint <= 0x7f) {
        return 1;
    }
    if (codePoint <= 0x7ff) {
        return 2;
    }
    if (codePoint <= 0xffff) {
        return 3;
    }
    return 4;
}

function utf16WidthForCodePoint(codePoint: number): number {
    return codePoint > 0xffff ? 2 : 1;
}

/**
 * Convert an Amazon Comprehend offset (Unicode code points) into a JavaScript
 * UTF-16 code-unit index for `String.slice`.
 *
 * Astral characters (emoji) are one Comprehend code point but two JS units;
 * using the raw offset with `slice` shifts later entities and can leave PII.
 * Returns -1 when the offset is past the end of `text`.
 */
export function codePointOffsetToUtf16Index(text: string, codePointOffset: number): number {
    if (codePointOffset <= 0) {
        return 0;
    }

    let utf16Index = 0;
    let codePoints = 0;
    while (utf16Index < text.length && codePoints < codePointOffset) {
        const codePoint = text.codePointAt(utf16Index);
        if (codePoint === undefined) {
            break;
        }
        utf16Index += utf16WidthForCodePoint(codePoint);
        codePoints += 1;
    }
    return codePoints === codePointOffset ? utf16Index : -1;
}

/**
 * Split `text` into chunks whose UTF-8 encoding is at most `maxUtf8Bytes`.
 * Splits on Unicode code-point boundaries (never through a surrogate pair)
 * and prefers whitespace so PII spans are less likely to be cut in half.
 */
export function splitTextByUtf8ByteLimit(text: string, maxUtf8Bytes: number): Utf8TextChunk[] {
    if (!text) {
        return [];
    }
    if (maxUtf8Bytes < 1) {
        throw new Error("maxUtf8Bytes must be at least 1");
    }

    const chunks: Utf8TextChunk[] = [];
    let jsIndex = 0;
    let codePointOffset = 0;

    while (jsIndex < text.length) {
        let end = jsIndex;
        let bytes = 0;
        let codePoints = 0;
        let breakEnd = -1;
        let breakBytes = 0;
        let breakCodePoints = 0;

        while (end < text.length) {
            const codePoint = text.codePointAt(end);
            if (codePoint === undefined) {
                break;
            }
            const charBytes = utf8BytesForCodePoint(codePoint);
            if (bytes + charBytes > maxUtf8Bytes) {
                break;
            }

            const width = utf16WidthForCodePoint(codePoint);
            const char = text.slice(end, end + width);
            bytes += charBytes;
            end += width;
            codePoints += 1;

            if (/\s/u.test(char)) {
                breakEnd = end;
                breakBytes = bytes;
                breakCodePoints = codePoints;
            }
        }

        if (end < text.length && breakEnd > jsIndex && breakBytes >= maxUtf8Bytes / 2) {
            end = breakEnd;
            codePoints = breakCodePoints;
        }

        if (end === jsIndex) {
            const codePoint = text.codePointAt(end);
            if (codePoint === undefined) {
                break;
            }
            end += utf16WidthForCodePoint(codePoint);
            codePoints = 1;
        }

        chunks.push({
            codePointOffset,
            text: text.slice(jsIndex, end),
        });
        jsIndex = end;
        codePointOffset += codePoints;
    }

    return chunks;
}

/**
 * Detect and redact PII in prompts using Amazon Comprehend, then chain the
 * redacted prompt into existing AI endpoint classes (`OpenAI`, `GeminiAI`,
 * `LlamaAI`) the same way those classes already chain: Promises.
 *
 * Real-time detection uses `DetectPiiEntities`; redaction is applied locally
 * from the returned offsets, matching the patterns in the AWS Comprehend PII
 * redaction blogs.
 *
 * DetectPiiEntities is limited to 100 KB of UTF-8 per call. Longer prompts are
 * split into UTF-8-size-bounded chunks so chained endpoints still redact
 * instead of throwing `TextSizeLimitExceededException`.
 */
export class AWSComprehend {
    private client: ComprehendClientLike;
    private entityTypes?: string[];
    private languageCode: LanguageCode | string;
    private maskCharacter: string;
    private maskMode: MaskMode;
    private maxUtf8Bytes: number;
    private minScore: number;
    private replacement?: RedactionReplacement;

    constructor(options: AWSComprehendOptions = {}) {
        this.client =
            options.client ||
            (new ComprehendClient({
                region: options.region || process.env.AWS_REGION || "us-east-1",
                credentials:
                    options.accessKeyId && options.secretAccessKey
                        ? {
                              accessKeyId: options.accessKeyId,
                              secretAccessKey: options.secretAccessKey,
                              sessionToken: options.sessionToken,
                          }
                        : undefined,
            }) as ComprehendClientLike);
        this.entityTypes = options.entityTypes;
        this.languageCode = options.languageCode || "en";
        this.maskCharacter = options.maskCharacter || "*";
        this.maskMode = options.maskMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        this.maxUtf8Bytes = options.maxUtf8Bytes || DETECT_PII_ENTITIES_MAX_UTF8_BYTES;
        this.minScore = options.minScore ?? 0;
        this.replacement = options.replacement;
    }

    async detectPiiEntities(options: RedactPiiOptions | string): Promise<PiiEntity[]> {
        const redactOptions = this.normalizeOptions(options);
        if (!redactOptions.text) {
            return [];
        }

        const languageCode = (redactOptions.languageCode || this.languageCode) as LanguageCode;
        const chunks = splitTextByUtf8ByteLimit(redactOptions.text, this.maxUtf8Bytes);
        const entities: PiiEntity[] = [];

        for (const chunk of chunks) {
            const response = (await this.client.send(
                new DetectPiiEntitiesCommand({
                    LanguageCode: languageCode,
                    Text: chunk.text,
                })
            )) as { Entities?: PiiEntity[] };

            for (const entity of response.Entities || []) {
                entities.push({
                    ...entity,
                    BeginOffset:
                        entity.BeginOffset === undefined
                            ? undefined
                            : entity.BeginOffset + chunk.codePointOffset,
                    EndOffset:
                        entity.EndOffset === undefined
                            ? undefined
                            : entity.EndOffset + chunk.codePointOffset,
                });
            }
        }

        return entities.filter((entity) => this.isIncluded(entity, redactOptions));
    }

    async containsPii(options: RedactPiiOptions | string): Promise<boolean> {
        const entities = await this.detectPiiEntities(options);
        return entities.length > 0;
    }

    async redact(options: RedactPiiOptions | string): Promise<RedactPiiResult> {
        const redactOptions = this.normalizeOptions(options);
        const entities = await this.detectPiiEntities(redactOptions);

        return {
            entities,
            redactedText: this.applyRedactions(redactOptions.text, entities, redactOptions),
            text: redactOptions.text,
        };
    }

    async redactPrompt(options: RedactPiiOptions | string): Promise<string> {
        const result = await this.redact(options);
        return result.redactedText;
    }

    async redactPromptOptions<T extends RedactablePromptOptions>(options: T): Promise<T> {
        const redactedOptions = { ...options };

        if (typeof options.prompt === "string") {
            redactedOptions.prompt = await this.redactPrompt(options.prompt);
        }

        if (typeof options.input === "string") {
            redactedOptions.input = await this.redactPrompt(options.input);
        } else if (Array.isArray(options.input)) {
            redactedOptions.input = await Promise.all(
                options.input.map((item) =>
                    typeof item === "string" ? this.redactPrompt(item) : item
                )
            );
        }

        if (Array.isArray(options.messages)) {
            redactedOptions.messages = await this.redactMessageArray(options.messages);
        }

        return redactedOptions;
    }

    /**
     * Operator for Promise `pipe()` composition:
     * `pipe(prompt, redactor.asOperator(), (safe) => openai.chat({ prompt: safe }))`
     */
    asOperator(overrides: Omit<RedactPiiOptions, "text"> = {}) {
        return (text: string) => this.redactPrompt({ ...overrides, text });
    }

    /**
     * Operator that redacts `prompt` / `messages` / `input` on endpoint options.
     */
    asPromptOperator() {
        return <T extends RedactablePromptOptions>(options: T) => this.redactPromptOptions(options);
    }

    /**
     * Wrap an existing endpoint class (`OpenAI`, `GeminiAI`, `LlamaAI`, or a
     * compatible `chat()` implementation) so PII is redacted before the call.
     *
     * The current JS SDK is Promise-based rather than RxJS; this is the same
     * chaining model used by `OpenAI.chat()` and the Jsonnet native callbacks.
     */
    chain<T extends object>(endpoint: T): T {
        return new ComprehendRedactionEndpoint(this, endpoint).asEndpoint();
    }

    async redactCallArgs(args: unknown[]): Promise<unknown[]> {
        if (args.length === 0) {
            return args;
        }

        const first = args[0];
        if (typeof first === "string") {
            return [await this.redactPrompt(first), ...args.slice(1)];
        }
        if (Array.isArray(first)) {
            return [await this.redactArrayArg(first), ...args.slice(1)];
        }
        if (isRecord(first)) {
            return [
                await this.redactPromptOptions(first as RedactablePromptOptions),
                ...args.slice(1),
            ];
        }
        return args;
    }

    private async redactArrayArg(items: unknown[]): Promise<unknown[]> {
        return Promise.all(
            items.map(async (item) => {
                if (typeof item === "string") {
                    return this.redactPrompt(item);
                }
                if (isRecord(item) && typeof item.content === "string") {
                    return {
                        ...item,
                        content: await this.redactPrompt(item.content),
                    };
                }
                return item;
            })
        );
    }

    private async redactMessageArray(messages: RedactableMessage[]): Promise<RedactableMessage[]> {
        return Promise.all(
            messages.map(async (message) => {
                if (typeof message.content !== "string") {
                    return { ...message };
                }
                return {
                    ...message,
                    content: await this.redactPrompt(message.content),
                };
            })
        );
    }

    private normalizeOptions(options: RedactPiiOptions | string): RedactPiiOptions {
        return typeof options === "string" ? { text: options } : options;
    }

    private isIncluded(entity: PiiEntity, options: RedactPiiOptions): boolean {
        if (entity.BeginOffset === undefined || entity.EndOffset === undefined) {
            return false;
        }
        if ((entity.Score || 0) < (options.minScore ?? this.minScore)) {
            return false;
        }
        const allowedTypes = options.entityTypes || this.entityTypes;
        return !allowedTypes || allowedTypes.includes(entity.Type || "");
    }

    private applyRedactions(
        text: string,
        entities: PiiEntity[],
        options: RedactPiiOptions
    ): string {
        return [...entities]
            .map((entity) => {
                const begin = codePointOffsetToUtf16Index(text, entity.BeginOffset || 0);
                const end = codePointOffsetToUtf16Index(
                    text,
                    entity.EndOffset === undefined ? entity.BeginOffset || 0 : entity.EndOffset
                );
                return { begin, end, entity };
            })
            .filter(({ begin, end }) => begin >= 0 && end >= 0 && end <= text.length && begin < end)
            .sort((a, b) => b.begin - a.begin)
            .reduce((redactedText, { begin, end, entity }) => {
                const original = redactedText.slice(begin, end);
                const redaction = this.buildReplacement(entity, original, options);
                return redactedText.slice(0, begin) + redaction + redactedText.slice(end);
            }, text);
    }

    private buildReplacement(
        entity: PiiEntity,
        original: string,
        options: RedactPiiOptions
    ): string {
        const replacement = options.replacement ?? this.replacement;
        if (typeof replacement === "function") {
            return replacement(entity, original);
        }
        if (typeof replacement === "string") {
            return replacement;
        }

        const maskMode = options.maskMode || this.maskMode;
        if (maskMode === "MASK") {
            const maskCharacter = options.maskCharacter || this.maskCharacter;
            return maskCharacter.repeat(original.length);
        }

        return `[${entity.Type || "PII"}]`;
    }
}

/**
 * Endpoint-style wrapper so Comprehend redaction can sit in front of any
 * existing AI class that exposes `chat()` (or the other prompt-taking methods).
 */
export class ComprehendRedactionEndpoint<T extends object> {
    constructor(
        private readonly comprehend: AWSComprehend,
        private readonly endpoint: T
    ) {}

    asEndpoint(): T {
        const comprehend = this.comprehend;
        const endpoint = this.endpoint;

        return new Proxy(endpoint, {
            get(target, prop, receiver) {
                const value = Reflect.get(target, prop, receiver);
                if (typeof value !== "function") {
                    return value;
                }
                if (!CHAINABLE_ENDPOINT_METHODS.has(String(prop))) {
                    return value.bind(target);
                }
                return async (...args: unknown[]) => {
                    const nextArgs = await comprehend.redactCallArgs(args);
                    return value.apply(target, nextArgs);
                };
            },
        });
    }
}

/** Compatibility alias used by some call sites / earlier drafts. */
export class ComprehendPIIRedactor extends AWSComprehend {}

type Operator<T, R> = (value: T) => R | Promise<R>;

export async function pipe<A>(value: A | Promise<A>): Promise<A>;
export async function pipe<A, B>(value: A | Promise<A>, fn1: Operator<A, B>): Promise<B>;
export async function pipe<A, B, C>(
    value: A | Promise<A>,
    fn1: Operator<A, B>,
    fn2: Operator<B, C>
): Promise<C>;
export async function pipe<A, B, C, D>(
    value: A | Promise<A>,
    fn1: Operator<A, B>,
    fn2: Operator<B, C>,
    fn3: Operator<C, D>
): Promise<D>;
export async function pipe(
    value: unknown,
    ...fns: Array<Operator<unknown, unknown>>
): Promise<unknown> {
    let current = await value;
    for (const fn of fns) {
        current = await fn(current);
    }
    return current;
}

export type {
    LanguageCode,
    PiiEntity,
};

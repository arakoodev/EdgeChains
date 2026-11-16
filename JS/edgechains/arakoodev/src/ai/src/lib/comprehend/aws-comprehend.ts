import {
    ComprehendClient,
    ContainsPiiEntitiesCommand,
    DetectPiiEntitiesCommand,
    type LanguageCode,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";
import { applyRedactions } from "./apply-redaction.js";
import { splitTextByUtf8ByteLimit, uniqueLabels } from "./text.js";
import {
    DETECT_PII_ENTITIES_MAX_UTF8_BYTES,
    type AWSComprehendOptions,
    type ComprehendClientLike,
    type ContainsPiiResult,
    type MaskMode,
    type PiiLabel,
    type RedactableMessage,
    type RedactablePromptOptions,
    type RedactPiiOptions,
    type RedactPiiResult,
    type RedactTranscriptResult,
    type RedactionReplacement,
    type TranscriptTurn,
    type Utf8TextChunk,
} from "./types.js";

const CHAINABLE_ENDPOINT_METHODS = new Set([
    "chat",
    "chatWithFunction",
    "embeddings",
    "generateEmbeddings",
    "gptFn",
    "gptFnChat",
    "makeRequest",
    "streamedChat",
    "zodSchemaResponse",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function comprehendErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
}

/**
 * Detect and redact PII in prompts using Amazon Comprehend, then chain the
 * redacted prompt into existing AI endpoint classes (`OpenAI`, `GeminiAI`,
 * `LlamaAI`) the same way those classes already chain: Promises.
 *
 * Real-time analysis follows the two-pass pattern from the Comprehend PII
 * blogs: `ContainsPiiEntities` for a cheap label scan, then `DetectPiiEntities`
 * for offsets. Redaction is applied locally from those offsets, matching
 * `REPLACE_WITH_PII_ENTITY_TYPE` and `MASK`.
 *
 * @see https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/
 * @see https://aws.amazon.com/blogs/machine-learning/how-to-redact-pii-data-in-conversation-transcripts/
 */
export class AWSComprehend {
    private client: ComprehendClientLike;
    private entityTypes?: string[];
    private languageCode: LanguageCode | string;
    private maskCharacter: string;
    private maskMode: MaskMode;
    private maxUtf8Bytes: number;
    private minScore: number;
    private preflight: boolean;
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
        this.preflight = options.preflight !== false;
        this.replacement = options.replacement;
    }

    /**
     * Cheap first pass: `ContainsPiiEntities` returns labels only (no offsets).
     */
    async containsPii(options: RedactPiiOptions | string): Promise<ContainsPiiResult> {
        const redactOptions = this.normalizeOptions(options);
        if (!redactOptions.text) {
            return { containsPii: false, labels: [], text: "" };
        }

        const labels = uniqueLabels(
            (
                await Promise.all(
                    splitTextByUtf8ByteLimit(redactOptions.text, this.maxUtf8Bytes).map((chunk) =>
                        this.sendContains(chunk.text, redactOptions)
                    )
                )
            ).flat()
        ).filter((label) => this.isRelevantLabel(label, redactOptions));

        return {
            containsPii: labels.length > 0,
            labels,
            text: redactOptions.text,
        };
    }

    async detectPiiEntities(options: RedactPiiOptions | string): Promise<PiiEntity[]> {
        const redactOptions = this.normalizeOptions(options);
        if (!redactOptions.text) {
            return [];
        }

        const entities = (
            await Promise.all(
                splitTextByUtf8ByteLimit(redactOptions.text, this.maxUtf8Bytes).map((chunk) =>
                    this.detectChunk(chunk, redactOptions)
                )
            )
        ).flat();

        return entities.filter((entity) => this.isIncluded(entity, redactOptions));
    }

    async redact(options: RedactPiiOptions | string): Promise<RedactPiiResult> {
        const redactOptions = this.normalizeOptions(options);
        if (!redactOptions.text) {
            return {
                entities: [],
                labels: [],
                redactedText: "",
                skippedDetection: true,
                text: "",
            };
        }

        const usePreflight = redactOptions.preflight ?? this.preflight;
        const chunks = splitTextByUtf8ByteLimit(redactOptions.text, this.maxUtf8Bytes);

        const perChunk = await Promise.all(
            chunks.map(async (chunk) => {
                const labels = usePreflight
                    ? await this.sendContains(chunk.text, redactOptions)
                    : [];
                if (usePreflight && !this.hasRelevantLabels(labels, redactOptions)) {
                    return { entities: [] as PiiEntity[], labels };
                }
                return {
                    entities: await this.detectChunk(chunk, redactOptions),
                    labels,
                };
            })
        );

        const labels = uniqueLabels(perChunk.flatMap((chunk) => chunk.labels)).filter((label) =>
            this.isRelevantLabel(label, redactOptions)
        );
        const entities = perChunk
            .flatMap((chunk) => chunk.entities)
            .filter((entity) => this.isIncluded(entity, redactOptions));
        const skippedDetection = usePreflight && entities.length === 0 && labels.length === 0;

        return {
            entities,
            labels,
            redactedText: applyRedactions(redactOptions.text, entities, {
                maskCharacter: redactOptions.maskCharacter || this.maskCharacter,
                maskMode: redactOptions.maskMode || this.maskMode,
                replacement: redactOptions.replacement ?? this.replacement,
            }),
            skippedDetection,
            text: redactOptions.text,
        };
    }

    async redactPrompt(options: RedactPiiOptions | string): Promise<string> {
        const result = await this.redact(options);
        return result.redactedText;
    }

    async redactMessages(messages: RedactableMessage[]): Promise<RedactableMessage[]> {
        return this.redactMessageArray(messages);
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
     * Redact a contact-center / conversation transcript turn by turn.
     * @see https://aws.amazon.com/blogs/machine-learning/how-to-redact-pii-data-in-conversation-transcripts/
     */
    async redactTranscript(turns: TranscriptTurn[]): Promise<RedactTranscriptResult> {
        const results = await Promise.all(turns.map((turn) => this.redact(turn.text || "")));
        return {
            entities: results.flatMap((result) => result.entities),
            labels: uniqueLabels(results.flatMap((result) => result.labels)),
            turns: turns.map((turn, index) => ({
                ...turn,
                text: results[index].redactedText,
            })),
        };
    }

    /** Operator for `pipe(prompt, redactor.asOperator(), (safe) => openai.chat({ prompt: safe }))`. */
    asOperator(overrides: Omit<RedactPiiOptions, "text"> = {}) {
        return (text: string) => this.redactPrompt({ ...overrides, text });
    }

    /** Operator that redacts `prompt` / `messages` / `input` on endpoint options. */
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

    private async detectChunk(
        chunk: Utf8TextChunk,
        options: RedactPiiOptions
    ): Promise<PiiEntity[]> {
        const response = await this.sendDetect(chunk.text, options);
        return (response.Entities || []).map((entity) => ({
            ...entity,
            BeginOffset:
                entity.BeginOffset === undefined
                    ? undefined
                    : entity.BeginOffset + chunk.codePointOffset,
            EndOffset:
                entity.EndOffset === undefined
                    ? undefined
                    : entity.EndOffset + chunk.codePointOffset,
        }));
    }

    private async sendContains(text: string, options: RedactPiiOptions): Promise<PiiLabel[]> {
        try {
            const response = (await this.client.send(
                new ContainsPiiEntitiesCommand({
                    LanguageCode: (options.languageCode || this.languageCode) as LanguageCode,
                    Text: text,
                })
            )) as { Labels?: PiiLabel[] };
            return response.Labels || [];
        } catch (error) {
            throw new Error(
                `Amazon Comprehend ContainsPiiEntities failed: ${comprehendErrorMessage(error)}`
            );
        }
    }

    private async sendDetect(
        text: string,
        options: RedactPiiOptions
    ): Promise<{ Entities?: PiiEntity[] }> {
        try {
            return (await this.client.send(
                new DetectPiiEntitiesCommand({
                    LanguageCode: (options.languageCode || this.languageCode) as LanguageCode,
                    Text: text,
                })
            )) as { Entities?: PiiEntity[] };
        } catch (error) {
            throw new Error(
                `Amazon Comprehend DetectPiiEntities failed: ${comprehendErrorMessage(error)}`
            );
        }
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

    private isRelevantLabel(label: PiiLabel, options: RedactPiiOptions): boolean {
        if ((label.Score || 0) < (options.minScore ?? this.minScore)) {
            return false;
        }
        const allowedTypes = options.entityTypes || this.entityTypes;
        return !allowedTypes || allowedTypes.includes(label.Name || "");
    }

    private hasRelevantLabels(labels: PiiLabel[], options: RedactPiiOptions): boolean {
        return labels.some((label) => this.isRelevantLabel(label, options));
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
                    return (...args: unknown[]) => value.apply(target, args);
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

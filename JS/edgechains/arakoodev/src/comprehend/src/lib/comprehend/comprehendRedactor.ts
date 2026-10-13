import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type LanguageCode,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";

/**
 * Minimal shape every Endpoint class in this SDK (OpenAI, GeminiAI, LlamaAI, ...)
 * already satisfies, so the redactor can be chained in front of them.
 */
export interface ChatEndpointLike {
    chat(options: any): Promise<any>;
}

/**
 * How detected PII spans are rewritten (mirrors Comprehend's `MaskMode`):
 * - "REPLACE_WITH_PII_ENTITY_TYPE": the span is replaced by the entity type,
 *   e.g. `John Doe` -> `[NAME]` (default, matches the AWS redaction blog posts).
 * - "MASK_WITH_CHAR": every character of the span is replaced by `maskCharacter`
 *   while keeping the original length, e.g. `John Doe` -> `********`.
 */
export type MaskMode = "REPLACE_WITH_PII_ENTITY_TYPE" | "MASK_WITH_CHAR";

export interface ComprehendCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}

export interface RedactionConfig {
    /** Language of the prompt passed to Comprehend. Defaults to "en". */
    languageCode?: LanguageCode | string;
    /** Only redact these PII entity types (e.g. ["NAME", "EMAIL", "PHONE"]). Defaults to every detected type. */
    entityTypes?: string[];
    /** How detected spans are rewritten. Defaults to "REPLACE_WITH_PII_ENTITY_TYPE". */
    maskMode?: MaskMode;
    /** Character used when maskMode is "MASK_WITH_CHAR". Defaults to "*". */
    maskCharacter?: string;
    /**
     * Template used when maskMode is "REPLACE_WITH_PII_ENTITY_TYPE".
     * "{TYPE}" is substituted with the detected entity type. Defaults to "[{TYPE}]".
     */
    replacementToken?: string;
    /**
     * When true the result also carries the untouched original text
     * (equivalent to Comprehend's "redacted_and_unredacted" output). Defaults to false.
     */
    keepOriginal?: boolean;
}

export interface ComprehendRedactorOptions extends RedactionConfig {
    /** AWS region for Comprehend, e.g. "us-east-1". Falls back to AWS_REGION / AWS_DEFAULT_REGION. */
    region?: string;
    /** Static AWS credentials. Falls back to the standard AWS env vars / credential chain. */
    credentials?: ComprehendCredentials;
    /** Pre-built ComprehendClient, mainly useful for tests or custom client configuration. */
    client?: ComprehendClient;
}

export interface RedactionResult {
    /** The prompt with every detected PII span redacted. */
    redactedText: string;
    /** The untouched original prompt. Only present when keepOriginal is enabled. */
    originalText?: string;
    /** The PII entities that were redacted, in document order. */
    entities: PiiEntity[];
}

type RedactionListener = (result: RedactionResult) => void;

const DEFAULT_LANGUAGE_CODE = "en";
const DEFAULT_MASK_CHARACTER = "*";
const DEFAULT_REPLACEMENT_TOKEN = "[{TYPE}]";

/**
 * AWS Comprehend PII redaction utility.
 *
 * Calls `DetectPiiEntities` on a prompt and rewrites every detected PII span,
 * following the patterns from the AWS redaction blog posts:
 * https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/
 * https://aws.amazon.com/blogs/machine-learning/how-to-redact-pii-data-in-conversation-transcripts/
 *
 * The class is chainable with the existing Endpoint classes and exposes a small
 * observable-style subscription so callers can inspect what was redacted:
 *
 * ```ts
 * const redactor = new ComprehendPiiRedactor({ region: "us-east-1" });
 * const safeOpenAI = redactor.chain(new OpenAI({ apiKey }));
 * redactor.subscribe((result) => console.log(`redacted ${result.entities.length} PII entities`));
 * await safeOpenAI.chat({ prompt: "My email is jane@example.com" });
 * ```
 */
export class ComprehendPiiRedactor {
    private readonly comprehend: ComprehendClient;
    private readonly languageCode: LanguageCode | string;
    private readonly entityTypes: string[] | undefined;
    private readonly maskMode: MaskMode;
    private readonly maskCharacter: string;
    private readonly replacementToken: string;
    private readonly keepOriginal: boolean;
    private readonly listeners: RedactionListener[] = [];

    constructor(options: ComprehendRedactorOptions = {}) {
        this.comprehend =
            options.client ||
            new ComprehendClient({
                region: options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
                credentials: options.credentials || ComprehendPiiRedactor.credentialsFromEnv(),
            });
        this.languageCode = options.languageCode || process.env.COMPREHEND_LANGUAGE_CODE || DEFAULT_LANGUAGE_CODE;
        this.entityTypes = options.entityTypes;
        this.maskMode = options.maskMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || DEFAULT_MASK_CHARACTER;
        this.replacementToken = options.replacementToken || DEFAULT_REPLACEMENT_TOKEN;
        this.keepOriginal = options.keepOriginal || false;
    }

    /**
     * Standard AWS env-var credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN).
     * Returns undefined when they are not set so the SDK's default provider chain
     * (shared credentials file, SSO, IAM roles, ...) can take over.
     */
    private static credentialsFromEnv(): ComprehendCredentials | undefined {
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        if (!accessKeyId || !secretAccessKey) {
            return undefined;
        }
        return {
            accessKeyId,
            secretAccessKey,
            sessionToken: process.env.AWS_SESSION_TOKEN,
        };
    }

    /** Underlying Comprehend client (exposed for advanced use). */
    get client(): ComprehendClient {
        return this.comprehend;
    }

    /**
     * Subscribe to every redaction performed by this instance (observable style).
     * @returns an unsubscribe function.
     */
    subscribe(listener: RedactionListener): () => void {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index !== -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    private notify(result: RedactionResult): void {
        for (const listener of [...this.listeners]) {
            try {
                listener(result);
            } catch (error) {
                console.error("ComprehendPiiRedactor listener failed:", error);
            }
        }
    }

    /**
     * Detect PII entities in the given text via Comprehend's `DetectPiiEntities` API.
     * Entities are sorted by position and overlapping detections are collapsed
     * (Comprehend may return overlapping spans) so redaction is idempotent.
     */
    async detectPiiEntities(
        text: string,
        languageCode?: LanguageCode | string,
        entityTypes: string[] | undefined = this.entityTypes
    ): Promise<PiiEntity[]> {
        if (!text) {
            return [];
        }
        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: (languageCode || this.languageCode) as LanguageCode,
        });
        const response = await this.comprehend.send(command);
        return ComprehendPiiRedactor.normalizeEntities(response.Entities ?? [], entityTypes);
    }

    /** Sort by position and drop overlapping spans, keeping the longer (then higher-scored) one. */
    static normalizeEntities(entities: PiiEntity[], entityTypes?: string[]): PiiEntity[] {
        const filtered = entityTypes
            ? entities.filter((entity) => entityTypes.includes(entity.Type ?? ""))
            : entities;
        const sorted = [...filtered].sort((a, b) => {
            const start = (a.BeginOffset ?? 0) - (b.BeginOffset ?? 0);
            if (start !== 0) {
                return start;
            }
            const end = (b.EndOffset ?? 0) - (a.EndOffset ?? 0);
            if (end !== 0) {
                return end;
            }
            return (b.Score ?? 0) - (a.Score ?? 0);
        });
        const accepted: PiiEntity[] = [];
        for (const entity of sorted) {
            const last = accepted[accepted.length - 1];
            if (last && (entity.BeginOffset ?? 0) < (last.EndOffset ?? 0)) {
                continue;
            }
            accepted.push(entity);
        }
        return accepted;
    }

    /**
     * Detect PII in `text` and return the redacted prompt plus the entities removed.
     * Per-call `overrides` take precedence over the constructor config.
     */
    async redact(text: string, overrides?: RedactionConfig): Promise<RedactionResult> {
        const config: RedactionConfig = {
            languageCode: this.languageCode,
            entityTypes: this.entityTypes,
            maskMode: this.maskMode,
            maskCharacter: this.maskCharacter,
            replacementToken: this.replacementToken,
            keepOriginal: this.keepOriginal,
            ...overrides,
        };
        const entities = await this.detectPiiEntities(text, config.languageCode, config.entityTypes);
        const result = ComprehendPiiRedactor.redactWithEntities(text, entities, config);
        this.notify(result);
        return result;
    }

    /** Pure redaction of already-detected entities (no Comprehend call). */
    static redactWithEntities(
        text: string,
        entities: PiiEntity[],
        config: RedactionConfig & {
            maskMode?: MaskMode;
            maskCharacter?: string;
            replacementToken?: string;
            keepOriginal?: boolean;
        }
    ): RedactionResult {
        const entityTypes = config.entityTypes;
        const maskMode = config.maskMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        const maskCharacter = config.maskCharacter || DEFAULT_MASK_CHARACTER;
        const replacementToken = config.replacementToken || DEFAULT_REPLACEMENT_TOKEN;

        const selected = ComprehendPiiRedactor.normalizeEntities(entities, entityTypes);

        // Apply replacements from the end of the string so earlier offsets stay valid.
        let redactedText = text;
        for (const entity of [...selected].sort((a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0))) {
            const begin = entity.BeginOffset ?? 0;
            const end = entity.EndOffset ?? 0;
            const replacement =
                maskMode === "MASK_WITH_CHAR"
                    ? maskCharacter.repeat(Math.max(end - begin, 0))
                    : replacementToken.replace("{TYPE}", entity.Type ?? "PII");
            redactedText = redactedText.slice(0, begin) + replacement + redactedText.slice(end);
        }

        const result: RedactionResult = { redactedText, entities: selected };
        if (config.keepOriginal) {
            result.originalText = text;
        }
        return result;
    }

    /**
     * Chain this redactor in front of an existing Endpoint class instance.
     * Every `chat(...)` call on the returned chain redacts `prompt` and
     * `messages[*].content` before delegating to the endpoint.
     */
    chain<T extends ChatEndpointLike>(endpoint: T): RedactionChain<T> {
        return new RedactionChain(endpoint, this);
    }
}

/**
 * Wraps an existing Endpoint instance so prompts are redacted before they reach it.
 * Works with any class exposing `chat(...)` (OpenAI, GeminiAI, LlamaAI, mocks, ...).
 */
export class RedactionChain<T extends ChatEndpointLike> {
    private lastRedaction: RedactionResult | null = null;

    constructor(
        private readonly endpoint: T,
        private readonly redactor: ComprehendPiiRedactor
    ) {}

    /** Redaction result of the most recent `chat` call. */
    get redactions(): RedactionResult | null {
        return this.lastRedaction;
    }

    /** Register an observer for redaction events triggered through this chain. */
    subscribe(listener: RedactionListener): () => void {
        return this.redactor.subscribe(listener);
    }

    async chat(options: {
        prompt?: string;
        messages?: Array<{ content?: string; [key: string]: any }>;
        [key: string]: any;
    }): Promise<any> {
        const nextOptions: any = { ...options };

        if (typeof nextOptions.prompt === "string") {
            const result = await this.redactor.redact(nextOptions.prompt);
            this.lastRedaction = result;
            nextOptions.prompt = result.redactedText;
        }

        if (Array.isArray(nextOptions.messages)) {
            nextOptions.messages = await Promise.all(
                nextOptions.messages.map(async (message: { content?: string }) => {
                    if (message && typeof message.content === "string") {
                        const result = await this.redactor.redact(message.content);
                        this.lastRedaction = result;
                        return { ...message, content: result.redactedText };
                    }
                    return message;
                })
            );
        }

        return this.endpoint.chat(nextOptions);
    }
}

import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    ContainsPiiEntitiesCommand,
    LanguageCode,
    type PiiEntity,
    type PiiEntityType,
} from "@aws-sdk/client-comprehend";

/**
 * Configuration options for the AWS Comprehend client.
 * Credentials can be provided directly or via environment variables
 * (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_DEFAULT_REGION).
 */
export interface PiiRedactorOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
}

/** Options for PII detection */
export interface DetectPiiOptions {
    text: string;
    languageCode?: string;
    piiEntityTypes?: PiiEntityType[];
}

/** Options for PII redaction */
export interface RedactOptions {
    text: string;
    languageCode?: string;
    piiEntityTypes?: PiiEntityType[];
    /** Character used to mask detected PII. Default: "[REDACTED]" */
    maskMode?: "char" | "label" | "fixed";
    /** Custom mask character when maskMode is "char". Default: "*" */
    maskChar?: string;
    /** Custom fixed replacement when maskMode is "fixed". Default: "[REDACTED]" */
    maskValue?: string;
}

/** Result of PII detection */
export interface DetectPiiResult {
    entities: PiiEntity[];
    hasPii: boolean;
}

/** Result of PII redaction */
export interface RedactResult {
    /** The redacted text */
    redactedText: string;
    /** Detected PII entities */
    entities: PiiEntity[];
    /** Original text before redaction */
    originalText: string;
    /** Map of redacted segments back to entity types */
    entityMap: Record<string, PiiEntityType>;
}

/**
 * A pipeline step that can be chained with EdgeChains endpoint classes.
 * Wraps any async function that transforms a string, enabling composable
 * prompt processing pipelines.
 *
 * @example
 * ```ts
 * const redactor = new PiiRedactor({ region: "us-east-1" });
 * const openai = new OpenAI({ apiKey: "..." });
 *
 * // Chain: redact PII -> send to LLM
 * const safePrompt = await redactor.redact({ text: prompt });
 * const response = await openai.chat({ prompt: safePrompt.redactedText });
 * ```
 */
export class PiiRedactor implements PromiseLike<RedactResult> {
    private client: ComprehendClient;
    private _redactOptions?: RedactOptions;
    private _redactPromise?: Promise<RedactResult>;

    /**
     * Create a new PiiRedactor instance.
     * AWS credentials are resolved in order:
     * 1. Constructor options (accessKeyId/secretAccessKey)
     * 2. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
     * 3. Default credential provider chain (IAM role, etc.)
     */
    constructor(options?: PiiRedactorOptions) {
        const region =
            options?.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

        const credentials =
            options?.accessKeyId && options?.secretAccessKey
                ? {
                      accessKeyId: options.accessKeyId,
                      secretAccessKey: options.secretAccessKey,
                  }
                : undefined;

        this.client = new ComprehendClient({
            region,
            ...(credentials ? { credentials } : {}),
        });
    }

    /**
     * Detect PII entities in text.
     * @returns Detected entities and whether any PII was found
     */
    async detectPiiEntities(options: DetectPiiOptions): Promise<DetectPiiResult> {
        const command = new DetectPiiEntitiesCommand({
            Text: options.text,
            LanguageCode: (options.languageCode || "en") as LanguageCode,
        });

        const response = await this.client.send(command);
        let entities = response.Entities || [];

        // Filter by entity types if specified
        if (options.piiEntityTypes && options.piiEntityTypes.length > 0) {
            entities = entities.filter(
                (entity) => entity.Type && options.piiEntityTypes!.includes(entity.Type)
            );
        }

        return {
            entities,
            hasPii: entities.length > 0,
        };
    }

    /**
     * Check whether text contains any PII entities.
     * More efficient than detectPiiEntities when you only need a boolean.
     */
    async containsPii(options: { text: string; languageCode?: string }): Promise<boolean> {
        const command = new ContainsPiiEntitiesCommand({
            Text: options.text,
            LanguageCode: (options.languageCode || "en") as LanguageCode,
        });

        const response = await this.client.send(command);
        return (response.Labels || []).length > 0;
    }

    /**
     * Redact PII from text.
     * Processes entities from end to start to preserve character offsets.
     *
     * @param options - Text and redaction configuration
     * @returns Redacted text, original entities, and entity map
     */
    async redact(options: RedactOptions): Promise<RedactResult> {
        const maskMode = options.maskMode || "fixed";
        const maskChar = options.maskChar || "*";
        const maskValue = options.maskValue || "[REDACTED]";

        const detectResult = await this.detectPiiEntities({
            text: options.text,
            languageCode: options.languageCode,
            piiEntityTypes: options.piiEntityTypes,
        });

        let redactedText = options.text;
        const entityMap: Record<string, PiiEntityType> = {};

        // Sort entities by position descending to preserve offsets during replacement
        const sorted = [...detectResult.entities].sort(
            (a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0)
        );

        for (const entity of sorted) {
            if (entity.BeginOffset !== undefined && entity.EndOffset !== undefined && entity.Type) {
                const length = entity.EndOffset - entity.BeginOffset;
                let replacement: string;

                switch (maskMode) {
                    case "char":
                        replacement = maskChar.repeat(length);
                        break;
                    case "label":
                        replacement = `[${entity.Type}]`;
                        break;
                    case "fixed":
                    default:
                        replacement = maskValue;
                        break;
                }

                redactedText =
                    redactedText.slice(0, entity.BeginOffset) +
                    replacement +
                    redactedText.slice(entity.EndOffset);

                // Track which replacement maps to which entity type
                entityMap[replacement] = entity.Type;
            }
        }

        return {
            redactedText,
            entities: detectResult.entities,
            originalText: options.text,
            entityMap,
        };
    }

    /**
     * Convenience method: redact a prompt and return only the redacted string.
     * Useful for quick chaining with endpoint classes.
     */
    async redactPrompt(
        prompt: string,
        options?: { languageCode?: string; piiEntityTypes?: PiiEntityType[] }
    ): Promise<string> {
        const result = await this.redact({ text: prompt, ...options });
        return result.redactedText;
    }

    /**
     * Chain a redaction operation and pipe the result into a callback.
     * This enables fluent chaining with EdgeChains endpoint classes.
     *
     * @example
     * ```ts
     * const redactor = new PiiRedactor({ region: "us-east-1" });
     * const openai = new OpenAI({ apiKey: "..." });
     *
     * const response = await redactor
     *   .pipe("My phone is 555-1234 and I live at 123 Main St")
     *   .then((result) => openai.chat({ prompt: result.redactedText }));
     * ```
     */
    pipe(text: string, options?: Omit<RedactOptions, "text">): PiiRedactor {
        this._redactOptions = { text, ...options };
        this._redactPromise = this.redact(this._redactOptions);
        return this;
    }

    /**
     * Chain another redaction or transformation after this one.
     * The redacted text from the previous step feeds into the next.
     *
     * @example
     * ```ts
     * const response = await redactor
     *   .pipe("My SSN is 123-45-6789")
     *   .chain((result) => openai.chat({ prompt: result.redactedText }));
     * ```
     */
    chain<T>(fn: (result: RedactResult) => Promise<T>): Promise<T> {
        if (!this._redactPromise) {
            throw new Error("No pipe operation started. Call .pipe(text) before .chain(fn).");
        }
        return this._redactPromise.then(fn);
    }

    // PromiseLike implementation enables await on piped redactor
    then<TResult1 = RedactResult, TResult2 = never>(
        onfulfilled?: ((value: RedactResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        if (!this._redactPromise) {
            return Promise.reject(new Error("No pipe operation started. Call .pipe(text) first."));
        }
        return this._redactPromise.then(onfulfilled, onrejected);
    }
}

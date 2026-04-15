import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";

/**
 * PII entity types that AWS Comprehend can detect.
 * Use these to filter which types you want to redact.
 */
export type PIICategory =
    | "BANK_ACCOUNT_NUMBER"
    | "BANK_ROUTING"
    | "CREDIT_DEBIT_NUMBER"
    | "CREDIT_DEBIT_CVV"
    | "CREDIT_DEBIT_EXPIRY"
    | "EMAIL"
    | "ADDRESS"
    | "NAME"
    | "PHONE"
    | "SSN"
    | "DATE_TIME"
    | "PASSPORT_NUMBER"
    | "DRIVER_ID"
    | "URL"
    | "AGE"
    | "USERNAME"
    | "PASSWORD"
    | "AWS_ACCESS_KEY"
    | "AWS_SECRET_KEY"
    | "IP_ADDRESS"
    | "MAC_ADDRESS"
    | "ALL"
    | "NONE";

export interface ComprehendRedactorOptions {
    /** AWS region (default: "us-east-1") */
    region?: string;
    /** AWS credentials (falls back to default credential chain) */
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    };
    /** What to replace PII with (default: "[REDACTED]") */
    mask?: string;
    /** Only redact these entity types. Empty array = redact all. */
    entityTypes?: PIICategory[];
    /** Language code (default: "en") */
    languageCode?: string
}

export interface RedactionResult {
    /** The text with PII replaced by the mask */
    redactedText: string;
    /** Details about what was redacted */
    entities: RedactedEntity[];
}

export interface RedactedEntity {
    type: string;
    score: number;
    beginOffset: number;
    endOffset: number;
    originalText: string;
}

/**
 * AWS Comprehend-backed PII redaction utility for EdgeChains.
 *
 * Chain it with Endpoint responses via `.pipe()` or call `.redact()` directly.
 *
 * @example
 * ```ts
 * const redactor = new ComprehendPIIRedactor({ region: "us-east-1" });
 *
 * // Direct usage
 * const result = await redactor.redact("My SSN is 123-45-6789");
 * // result.redactedText === "My SSN is [REDACTED]"
 *
 * // Chained with OpenAI endpoint
 * const openai = new OpenAI({ apiKey: "..." });
 * const response = await openai.chat({ prompt: "..." }).then(redactor.pipe());
 * ```
 */
export class ComprehendPIIRedactor {
    private client: ComprehendClient;
    private mask: string;
    private entityTypes: PIICategory[];
    private languageCode: "en" | "es" | "fr" | "de" | "it" | "pt" | "ar" | "hi" | "ja" | "ko" | "zh" | "zh-TW";

    constructor(options: ComprehendRedactorOptions = {}) {
        this.client = new ComprehendClient({
            region: options.region || "us-east-1",
            credentials: options.credentials,
        });
        this.mask = options.mask || "[REDACTED]";
        this.entityTypes = options.entityTypes || [];
        this.languageCode = (options.languageCode as any) || "en";
    }

    /**
     * Detect PII entities in text using AWS Comprehend.
     */
    async detectPII(text: string): Promise<PiiEntity[]> {
        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: this.languageCode,
        });

        const response = await this.client.send(command);
        return response.Entities || [];
    }

    /**
     * Redact PII from a string. Returns the redacted text and metadata about what was found.
     */
    async redact(text: string): Promise<RedactionResult> {
        const entities = await this.detectPII(text);
        const filtered = this.filterEntities(entities);

        // Sort by offset descending so we replace from end to start
        // (avoids offset shifting when we replace earlier text)
        const sorted = [...filtered].sort((a, b) => b.EndOffset! - a.EndOffset!);

        let redactedText = text;
        const redactedEntities: RedactedEntity[] = [];

        for (const entity of sorted) {
            const original = text.substring(entity.BeginOffset!, entity.EndOffset!);
            redactedEntities.push({
                type: entity.Type!,
                score: entity.Score!,
                beginOffset: entity.BeginOffset!,
                endOffset: entity.EndOffset!,
                originalText: original,
            });
            redactedText =
                redactedText.substring(0, entity.BeginOffset!) +
                this.mask +
                redactedText.substring(entity.EndOffset!);
        }

        // Reverse so they're in document order
        redactedEntities.reverse();

        return {
            redactedText,
            entities: redactedEntities,
        };
    }

    /**
     * Redact PII from an endpoint response object.
     * Looks for `.content` (EdgeChains standard) or treats the value as a string.
     */
    async redactFromResponse<T extends { content?: string } | string>(
        response: T
    ): Promise<{ content: string; redaction: RedactionResult }> {
        const text = typeof response === "string" ? response : response.content || "";
        const result = await this.redact(text);
        return { content: result.redactedText, redaction: result };
    }

    /**
     * Returns a function suitable for `.then()` chaining with endpoint responses.
     * Drops into promise chains: `endpoint.chat(opts).then(redactor.pipe())`
     */
    pipe(): (text: string) => Promise<string> {
        return async (text: string) => {
            const result = await this.redact(text);
            return result.redactedText;
        };
    }

    /**
     * Like pipe(), but preserves the full RedactionResult metadata.
     */
    pipeWithMeta(): (text: string) => Promise<RedactionResult> {
        return async (text: string) => {
            return this.redact(text);
        };
    }

    /**
     * Redact PII from all messages in an array (e.g., conversation history).
     */
    async redactMessages(
        messages: Array<{ role: string; content: string }>
    ): Promise<Array<{ role: string; content: string; redaction?: RedactionResult }>> {
        const results = [];
        for (const msg of messages) {
            const result = await this.redact(msg.content);
            results.push({
                role: msg.role,
                content: result.redactedText,
                redaction: result.entities.length > 0 ? result : undefined,
            });
        }
        return results;
    }

    private filterEntities(entities: PiiEntity[]): PiiEntity[] {
        if (this.entityTypes.length === 0) return entities;
        return entities.filter((e) =>
            this.entityTypes.includes(e.Type as PIICategory)
        );
    }
}

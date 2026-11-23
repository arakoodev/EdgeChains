import {
    ComprehendClient,
    ComprehendClientConfig,
    DetectPiiEntitiesCommand,
    DetectPiiEntitiesCommandInput,
    DetectPiiEntitiesCommandOutput,
    LanguageCode,
    PiiEntity,
    PiiEntityType,
} from "@aws-sdk/client-comprehend";

/**
 * Options accepted by the {@link ComprehendRedactor} constructor.
 *
 * Everything is optional so the client can fall back to the standard AWS
 * credential provider chain (environment variables, shared config, IAM role,
 * ...). This mirrors how the other EdgeChains AI utilities (e.g. `OpenAI`)
 * resolve their credentials from `process.env` when they are not passed in.
 */
export interface ComprehendRedactorOptions {
    /** AWS access key id. Falls back to the AWS default credential chain. */
    accessKeyId?: string;
    /** AWS secret access key. Falls back to the AWS default credential chain. */
    secretAccessKey?: string;
    /** AWS session token (for temporary credentials). */
    sessionToken?: string;
    /** AWS region, e.g. "us-east-1". Falls back to `AWS_REGION`. */
    region?: string;
    /** Optional pre-configured Comprehend client (handy for testing). */
    client?: ComprehendClient;
}

/** Options accepted by {@link ComprehendRedactor.redact}. */
export interface RedactOptions {
    /** Replacement token used for every detected entity. Defaults to "[REDACTED]". */
    replacement?: string;
    /**
     * Restrict redaction to a subset of PII entity types (e.g. ["NAME", "EMAIL"]).
     * When omitted every detected PII entity is redacted.
     */
    entityTypes?: PiiEntityType[];
    /** Language of the input text. Defaults to English. */
    language?: LanguageCode;
}

/** A single PII entity detected inside the input text. */
export interface PiiEntityMatch {
    type: PiiEntityType;
    /** Character offset (inclusive) where the entity starts. */
    beginOffset: number;
    /** Character offset (exclusive) where the entity ends. */
    endOffset: number;
    /** Confidence score reported by Comprehend (0-1). */
    score: number;
    /** The exact substring that was detected. */
    text: string;
}

/** Result returned by {@link ComprehendRedactor.redact}. */
export interface RedactResult {
    /** The input text with every targeted PII entity replaced. */
    redactedText: string;
    /** The raw PII entities returned by Amazon Comprehend. */
    entities: PiiEntityMatch[];
}

/**
 * `ComprehendRedactor` wires Amazon Comprehend's `detectPiiEntities` API into a
 * small, chainable utility that redacts sensitive information (names, emails,
 * phone numbers, credit cards, ...) from arbitrary text.
 *
 * It is designed to be chained in front of the existing EdgeChains `Endpoint`
 * classes so that prompts are scrubbed of PII before they ever reach an LLM:
 *
 * ```ts
 * const redactor = new ComprehendRedactor({ region: "us-east-1" });
 * const { redactedText } = await redactor.redact(
 *     "Reach John Doe at john.doe@example.com or 212-555-0199."
 * );
 * // -> "Reach [REDACTED] at [REDACTED] or [REDACTED]."
 * ```
 */
export class ComprehendRedactor {
    private client: ComprehendClient;

    constructor(options: ComprehendRedactorOptions = {}) {
        if (options.client) {
            this.client = options.client;
            return;
        }

        const region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
        const config: ComprehendClientConfig = { region };

        // Only set explicit credentials when they are provided; otherwise let the
        // AWS SDK resolve them from its default provider chain.
        if (options.accessKeyId && options.secretAccessKey) {
            config.credentials = {
                accessKeyId: options.accessKeyId,
                secretAccessKey: options.secretAccessKey,
                sessionToken: options.sessionToken,
            };
        }

        this.client = new ComprehendClient(config);
    }

    /**
     * Detect PII entities in `text` using Amazon Comprehend.
     * Returns the raw entities together with their offsets and scores.
     */
    async detectPiiEntities(
        text: string,
        language: LanguageCode = LanguageCode.EN
    ): Promise<PiiEntityMatch[]> {
        if (!text || !text.trim()) {
            return [];
        }

        const input: DetectPiiEntitiesCommandInput = {
            Text: text,
            LanguageCode: language,
        };

        const command = new DetectPiiEntitiesCommand(input);
        const response: DetectPiiEntitiesCommandOutput = await this.client.send(command);

        return (response.Entities || []).map((entity: PiiEntity) => ({
            type: entity.Type as PiiEntityType,
            beginOffset: entity.BeginOffset ?? 0,
            endOffset: entity.EndOffset ?? 0,
            score: entity.Score ?? 0,
            text: text.substring(entity.BeginOffset ?? 0, entity.EndOffset ?? 0),
        }));
    }

    /**
     * Detect PII entities in `text` and return a copy of the text with every
     * targeted entity replaced by `replacement` (default "[REDACTED]").
     *
     * Entities are replaced back-to-front so that the character offsets reported
     * by Comprehend remain valid as the string is mutated.
     */
    async redact(text: string, options: RedactOptions = {}): Promise<RedactResult> {
        const replacement = options.replacement ?? "[REDACTED]";
        const language = options.language ?? LanguageCode.EN;

        const entities = await this.detectPiiEntities(text, language);

        const targeted = options.entityTypes
            ? entities.filter((entity) => options.entityTypes!.includes(entity.type))
            : entities;

        // Sort by begin offset descending so replacements don't shift the offsets
        // of entities we have not processed yet.
        const ordered = [...targeted].sort((a, b) => b.beginOffset - a.beginOffset);

        let redactedText = text;
        for (const entity of ordered) {
            redactedText =
                redactedText.slice(0, entity.beginOffset) +
                replacement +
                redactedText.slice(entity.endOffset);
        }

        return { redactedText, entities };
    }
}
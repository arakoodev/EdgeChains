import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    PiiEntitiesDetectionMaskMode,
    LanguageCode,
} from "@aws-sdk/client-comprehend";

interface ComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

interface RedactOptions {
    text: string;
    languageCode?: LanguageCode;
    /**
     * Replacement token used to mask each detected PII entity.
     * Defaults to "***".
     */
    maskChar?: string;
    /**
     * Optional allow-list of PII entity types to redact. When omitted every
     * entity type returned by AWS Comprehend is redacted.
     */
    entityTypes?: string[];
}

interface RedactResult {
    redactedText: string;
    entities: Array<{
        type: string;
        beginOffset: number;
        endOffset: number;
        score: number;
    }>;
}

/**
 * AWSComprehendPIIRedactor redacts personally identifiable information (PII)
 * from free text using the AWS Comprehend `detectPiiEntities` API.
 *
 * It follows the same construction + method pattern as the other EdgeChains
 * utilities (e.g. OpenAI, GeminiAI): credentials are read from the options
 * object first and fall back to environment variables.
 */
export class AWSComprehendPIIRedactor {
    region: string;
    client: ComprehendClient;

    constructor(options: ComprehendOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.client = new ComprehendClient({
            region: this.region,
            credentials:
                options.accessKeyId && options.secretAccessKey
                    ? {
                          accessKeyId: options.accessKeyId,
                          secretAccessKey: options.secretAccessKey,
                      }
                    : undefined,
        });
    }

    /**
     * Detect PII entities in the supplied text.
     * @param text The text to analyse.
     * @param languageCode The language of the text. Defaults to English.
     * @returns The list of detected PII entities with offsets and scores.
     */
    async detectPiiEntities(
        text: string,
        languageCode: LanguageCode = "en"
    ): Promise<RedactResult["entities"]> {
        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: languageCode,
        });
        const response = await this.client.send(command);
        return (response.Entities || []).map((entity) => ({
            type: entity.Type as string,
            beginOffset: entity.BeginOffset as number,
            endOffset: entity.EndOffset as number,
            score: entity.Score as number,
        }));
    }

    /**
     * Redact PII entities from the supplied text.
     *
     * Each detected entity is replaced with `maskChar` (default "***"). When
     * `entityTypes` is provided only those entity types are redacted.
     *
     * @param options The redaction options (text, language, mask char, filter).
     * @returns The redacted text together with the entities that were masked.
     */
    async redact(options: RedactOptions): Promise<RedactResult> {
        const {
            text,
            languageCode = "en",
            maskChar = "***",
            entityTypes,
        } = options;

        const entities = await this.detectPiiEntities(text, languageCode);

        const toRedact = entityTypes
            ? entities.filter((entity) => entityTypes.includes(entity.type))
            : entities;

        // Apply replacements from the end of the string towards the start so
        // that earlier offsets remain valid after each replacement.
        const sorted = [...toRedact].sort((a, b) => b.beginOffset - a.beginOffset);

        let redactedText = text;
        for (const entity of sorted) {
            redactedText =
                redactedText.slice(0, entity.beginOffset) +
                maskChar +
                redactedText.slice(entity.endOffset);
        }

        return { redactedText, entities: toRedact };
    }
}

export { PiiEntitiesDetectionMaskMode };
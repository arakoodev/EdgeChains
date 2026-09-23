import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    DetectPiiEntitiesCommandInput,
    PiiEntity,
    PiiEntityType,
} from "@aws-sdk/client-comprehend";

interface AWSComprehendConstructionOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

interface RedactPIIOptions {
    /**
     * Language code for the input text. Defaults to "en".
     * Supported: "en", "es", "fr", "de", "it", "pt", "ar", "hi", "ja", "ko", "zh", "zh-TW"
     */
    languageCode?: string;
    /**
     * Custom redaction mask character or string. Defaults to "*".
     * e.g. "[REDACTED]", "****", "█"
     */
    maskChar?: string;
    /**
     * If true, replaces PII with a labeled placeholder like [NAME] or [EMAIL].
     * If false, replaces with maskChar repeated to match original length.
     * Defaults to true.
     */
    labeledRedaction?: boolean;
    /**
     * Specific PII entity types to redact. If omitted, all detected types are redacted.
     * e.g. ["NAME", "EMAIL", "PHONE"]
     */
    entityTypesToRedact?: string[];
}

interface DetectedPIIEntity {
    text: string;
    type: string;
    score: number;
    beginOffset: number;
    endOffset: number;
}

interface RedactPIIResult {
    originalText: string;
    redactedText: string;
    detectedEntities: DetectedPIIEntity[];
}

export class AWSComprehendPIIRedactor {
    private client: ComprehendClient;

    constructor(options: AWSComprehendConstructionOptions = {}) {
        const region = options.region || process.env.AWS_REGION || "us-east-1";
        const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

        if (!accessKeyId || !secretAccessKey) {
            console.warn(
                "AWS credentials not provided. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY " +
                    "in your .env file or pass them directly to the constructor."
            );
        }

        this.client = new ComprehendClient({
            region,
            credentials:
                accessKeyId && secretAccessKey
                    ? { accessKeyId, secretAccessKey }
                    : undefined,
        });
    }

    /**
     * Detect PII entities in the given text without redacting.
     */
    async detectPII(
        text: string,
        languageCode: string = "en"
    ): Promise<DetectedPIIEntity[]> {
        const input: DetectPiiEntitiesCommandInput = {
            Text: text,
            LanguageCode: languageCode as any,
        };

        const command = new DetectPiiEntitiesCommand(input);
        const response = await this.client.send(command);

        return (response.Entities || []).map((entity: PiiEntity) => ({
            text: text.slice(entity.BeginOffset!, entity.EndOffset!),
            type: entity.Type || "UNKNOWN",
            score: entity.Score || 0,
            beginOffset: entity.BeginOffset!,
            endOffset: entity.EndOffset!,
        }));
    }

    /**
     * Redact PII from the given text.
     * Returns both the redacted text and metadata about what was found.
     *
     * Can be chained with any endpoint:
     *   const redacted = await redactor.redactPII(userInput);
     *   const response = await openai.chat({ prompt: redacted.redactedText });
     */
    async redactPII(text: string, options: RedactPIIOptions = {}): Promise<RedactPIIResult> {
        const {
            languageCode = "en",
            maskChar = "*",
            labeledRedaction = true,
            entityTypesToRedact,
        } = options;

        const entities = await this.detectPII(text, languageCode);

        // Filter by entity type if specified
        const entitiesToRedact = entityTypesToRedact
            ? entities.filter((e) =>
                  entityTypesToRedact.map((t) => t.toUpperCase()).includes(e.type.toUpperCase())
              )
            : entities;

        // Sort by offset descending so we can replace from right to left
        // (avoids offset shifting when replacing)
        const sorted = [...entitiesToRedact].sort((a, b) => b.beginOffset - a.beginOffset);

        let redactedText = text;
        for (const entity of sorted) {
            const replacement = labeledRedaction
                ? `[${entity.type}]`
                : maskChar.repeat(entity.endOffset - entity.beginOffset);

            redactedText =
                redactedText.slice(0, entity.beginOffset) +
                replacement +
                redactedText.slice(entity.endOffset);
        }

        return {
            originalText: text,
            redactedText,
            detectedEntities: entities,
        };
    }

    /**
     * Convenience method: redact PII and return just the cleaned string.
     * Perfect for inline chaining into prompts.
     *
     * Example:
     *   const safePrompt = await redactor.sanitize(userInput);
     *   const answer = await openai.chat({ prompt: safePrompt });
     */
    async sanitize(text: string, options: RedactPIIOptions = {}): Promise<string> {
        const result = await this.redactPII(text, options);
        return result.redactedText;
    }
}

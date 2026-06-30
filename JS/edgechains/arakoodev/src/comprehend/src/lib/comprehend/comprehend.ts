import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    PiiEntity,
    LanguageCode,
} from "@aws-sdk/client-comprehend";

interface ComprehendConstructionOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
}

interface RedactOptions {
    /** Language of the text. Defaults to "en". */
    languageCode?: LanguageCode;
    /**
     * Builds the replacement string for a detected entity. Receives the PII
     * type (e.g. "EMAIL", "NAME") and returns the mask. Defaults to `[TYPE]`.
     */
    mask?: (type: string) => string;
}

/**
 * Comprehend wraps Amazon Comprehend's PII detection so sensitive data can be
 * stripped from a prompt before it is chained into an Endpoint class
 * (OpenAI, GeminiAI, LlamaAI, ...).
 *
 *   const comprehend = new Comprehend();
 *   const safePrompt = await comprehend.redact(userInput);
 *   const answer = await openai.chat({ prompt: safePrompt });
 */
export class Comprehend {
    private client: ComprehendClient;

    constructor(options: ComprehendConstructionOptions = {}) {
        const region = options.region || process.env.AWS_REGION || "us-east-1";
        const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

        this.checkKeys(accessKeyId, secretAccessKey);

        this.client = new ComprehendClient({
            region,
            // When the keys are absent the SDK falls back to the default
            // provider chain (env, shared config, IAM role, ...).
            credentials:
                accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
        });
    }

    private checkKeys(accessKeyId?: string, secretAccessKey?: string): void {
        if (!accessKeyId || !secretAccessKey) {
            console.warn(
                "AWS credentials are missing. Provide them in the constructor or as " +
                    "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY. The default AWS provider " +
                    "chain will be used instead."
            );
        }
    }

    /**
     * Returns the raw PII entities Amazon Comprehend detects in `text`.
     */
    async detectPii(text: string, languageCode: LanguageCode = "en"): Promise<PiiEntity[]> {
        if (!text) return [];
        const response = await this.client.send(
            new DetectPiiEntitiesCommand({ Text: text, LanguageCode: languageCode })
        );
        return response.Entities ?? [];
    }

    /**
     * Detects PII in `text` and replaces every entity with a mask, returning a
     * redacted copy of the string. Safe to chain straight into an Endpoint.
     */
    async redact(text: string, options: RedactOptions = {}): Promise<string> {
        const entities = await this.detectPii(text, options.languageCode ?? "en");
        return Comprehend.applyRedaction(text, entities, options.mask);
    }

    /**
     * Pure replacement step. Exposed (static) so the offset handling can be
     * unit-tested without hitting AWS. Entities are applied from the end of the
     * string backwards so earlier replacements never shift later offsets.
     */
    static applyRedaction(
        text: string,
        entities: PiiEntity[],
        mask: (type: string) => string = (type) => `[${type}]`
    ): string {
        if (!text || entities.length === 0) return text;

        const ordered = [...entities].sort(
            (a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0)
        );

        let redacted = text;
        for (const entity of ordered) {
            const { BeginOffset: begin, EndOffset: end, Type: type } = entity;
            if (begin == null || end == null || begin < 0 || end > text.length || begin >= end) {
                continue;
            }
            redacted = redacted.slice(0, begin) + mask(type ?? "PII") + redacted.slice(end);
        }
        return redacted;
    }
}

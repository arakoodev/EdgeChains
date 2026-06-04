import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    LanguageCode,
    PiiEntity,
} from "@aws-sdk/client-comprehend";

type ComprehendClientLike = Pick<ComprehendClient, "send">;
type RedactionReplacement = string | ((entity: PiiEntity) => string);

interface ComprehendPIIRedactorOptions {
    accessKeyId?: string;
    client?: ComprehendClientLike;
    entityTypes?: string[];
    languageCode?: LanguageCode;
    minScore?: number;
    region?: string;
    replacement?: RedactionReplacement;
    secretAccessKey?: string;
    sessionToken?: string;
}

interface RedactPIIOptions {
    entityTypes?: string[];
    languageCode?: LanguageCode;
    minScore?: number;
    replacement?: RedactionReplacement;
    text: string;
}

interface RedactPIIResponse {
    entities: PiiEntity[];
    redactedText: string;
    text: string;
}

export class ComprehendPIIRedactor {
    private client: ComprehendClientLike;
    private entityTypes?: string[];
    private languageCode: LanguageCode;
    private minScore: number;
    private replacement?: RedactionReplacement;

    constructor(options: ComprehendPIIRedactorOptions = {}) {
        this.client =
            options.client ||
            new ComprehendClient({
                region: options.region || process.env.AWS_REGION || "us-east-1",
                credentials:
                    options.accessKeyId && options.secretAccessKey
                        ? {
                              accessKeyId: options.accessKeyId,
                              secretAccessKey: options.secretAccessKey,
                              sessionToken: options.sessionToken,
                          }
                        : undefined,
            });
        this.entityTypes = options.entityTypes;
        this.languageCode = options.languageCode || LanguageCode.EN;
        this.minScore = options.minScore ?? 0;
        this.replacement = options.replacement;
    }

    async detectPiiEntities({
        entityTypes,
        languageCode,
        minScore,
        text,
    }: RedactPIIOptions): Promise<PiiEntity[]> {
        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                LanguageCode: languageCode || this.languageCode,
                Text: text,
            })
        );

        return (response.Entities || []).filter((entity) => {
            if (entity.BeginOffset === undefined || entity.EndOffset === undefined) {
                return false;
            }
            if ((entity.Score || 0) < (minScore ?? this.minScore)) {
                return false;
            }
            const allowedTypes = entityTypes || this.entityTypes;
            return !allowedTypes || allowedTypes.includes(entity.Type || "");
        });
    }

    async redact(options: RedactPIIOptions | string): Promise<RedactPIIResponse> {
        const redactOptions = typeof options === "string" ? { text: options } : options;
        const entities = await this.detectPiiEntities(redactOptions);

        return {
            entities,
            redactedText: this.redactText(
                redactOptions.text,
                entities,
                redactOptions.replacement || this.replacement
            ),
            text: redactOptions.text,
        };
    }

    private redactText(
        text: string,
        entities: PiiEntity[],
        replacement?: RedactionReplacement
    ): string {
        return [...entities]
            .sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0))
            .reduce((redactedText, entity) => {
                const beginOffset = entity.BeginOffset || 0;
                const endOffset = entity.EndOffset || beginOffset;
                const redaction =
                    typeof replacement === "function"
                        ? replacement(entity)
                        : replacement || `[${entity.Type || "PII"}]`;

                return (
                    redactedText.slice(0, beginOffset) +
                    redaction +
                    redactedText.slice(endOffset)
                );
            }, text);
    }
}

export type {
    ComprehendPIIRedactorOptions,
    RedactPIIOptions,
    RedactPIIResponse,
    RedactionReplacement,
};

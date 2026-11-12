import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    LanguageCode,
    PiiEntity,
} from "@aws-sdk/client-comprehend";

type ComprehendClientLike = Pick<ComprehendClient, "send">;
type RedactionReplacement = string | ((entity: PiiEntity) => string);

interface AWSComprehendOptions {
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

interface RedactableMessage {
    content?: string;
    [key: string]: any;
}

interface RedactablePromptOptions {
    messages?: RedactableMessage[];
    prompt?: string;
    [key: string]: any;
}

interface RedactPIIResponse {
    entities: PiiEntity[];
    redactedText: string;
    text: string;
}

export class AWSComprehend {
    private client: ComprehendClientLike;
    private entityTypes?: string[];
    private languageCode: LanguageCode;
    private minScore: number;
    private replacement?: RedactionReplacement;

    constructor(options: AWSComprehendOptions = {}) {
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

    async detectPiiEntities(options: RedactPIIOptions | string): Promise<PiiEntity[]> {
        const redactOptions = this.normalizeOptions(options);
        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                LanguageCode: redactOptions.languageCode || this.languageCode,
                Text: redactOptions.text,
            })
        );

        return (response.Entities || []).filter((entity) => {
            if (entity.BeginOffset === undefined || entity.EndOffset === undefined) {
                return false;
            }
            if ((entity.Score || 0) < (redactOptions.minScore ?? this.minScore)) {
                return false;
            }
            const allowedTypes = redactOptions.entityTypes || this.entityTypes;
            return !allowedTypes || allowedTypes.includes(entity.Type || "");
        });
    }

    async redact(options: RedactPIIOptions | string): Promise<RedactPIIResponse> {
        const redactOptions = this.normalizeOptions(options);
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

    async redactPrompt(options: RedactPIIOptions | string): Promise<string> {
        const result = await this.redact(options);

        return result.redactedText;
    }

    async containsPii(options: RedactPIIOptions | string): Promise<boolean> {
        const entities = await this.detectPiiEntities(options);

        return entities.length > 0;
    }

    async redactPromptOptions<T extends RedactablePromptOptions>(options: T): Promise<T> {
        const redactedOptions = { ...options };

        if (typeof options.prompt === "string") {
            redactedOptions.prompt = await this.redactPrompt(options.prompt);
        }

        if (Array.isArray(options.messages)) {
            redactedOptions.messages = await Promise.all(
                options.messages.map(async (message) => {
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

        return redactedOptions;
    }

    asPromptMiddleware() {
        return <T extends RedactablePromptOptions>(options: T) => this.redactPromptOptions(options);
    }

    private normalizeOptions(options: RedactPIIOptions | string): RedactPIIOptions {
        return typeof options === "string" ? { text: options } : options;
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

export class ComprehendPIIRedactor extends AWSComprehend {}

type ComprehendPIIRedactorOptions = AWSComprehendOptions;

export type {
    AWSComprehendOptions,
    ComprehendPIIRedactorOptions,
    RedactableMessage,
    RedactablePromptOptions,
    RedactPIIOptions,
    RedactPIIResponse,
    RedactionReplacement,
};

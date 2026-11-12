import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    LanguageCode,
    PiiEntity,
} from "@aws-sdk/client-comprehend";

interface ComprehendClientLike {
    send(command: DetectPiiEntitiesCommand): Promise<{ Entities?: PiiEntity[] }>;
}

interface MessageLike {
    content: string;
    [key: string]: unknown;
}

export interface AwsComprehendRedactorOptions {
    client?: ComprehendClientLike;
    region?: string;
    languageCode?: LanguageCode;
    minScore?: number;
    entityTypes?: string[];
    mask?: string | ((entity: PiiEntity) => string);
}

export interface ChatInputWithPrompt {
    prompt?: string;
    messages?: MessageLike[];
    [key: string]: unknown;
}

export class AwsComprehendRedactor {
    private readonly client: ComprehendClientLike;
    private readonly languageCode: LanguageCode;
    private readonly minScore: number;
    private readonly entityTypes?: Set<string>;
    private readonly mask: string | ((entity: PiiEntity) => string);

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.client =
            options.client ||
            new ComprehendClient({
                region: options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
            });
        this.languageCode = options.languageCode || LanguageCode.EN;
        this.minScore = options.minScore ?? 0;
        this.entityTypes = options.entityTypes ? new Set(options.entityTypes) : undefined;
        this.mask = options.mask || ((entity) => `[REDACTED_${entity.Type || "PII"}]`);
    }

    async redactText(text: string): Promise<string> {
        if (!text) {
            return text;
        }

        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: this.languageCode,
            })
        );

        const entities = (response.Entities || [])
            .filter((entity) => entity.BeginOffset !== undefined && entity.EndOffset !== undefined)
            .filter((entity) => (entity.Score ?? 1) >= this.minScore)
            .filter((entity) => !this.entityTypes || this.entityTypes.has(entity.Type || ""))
            .sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));

        return entities.reduce((redacted, entity) => {
            const begin = entity.BeginOffset || 0;
            const end = entity.EndOffset || begin;
            const replacement = typeof this.mask === "function" ? this.mask(entity) : this.mask;

            return redacted.slice(0, begin) + replacement + redacted.slice(end);
        }, text);
    }

    async redactMessages<T extends MessageLike>(messages: T[]): Promise<T[]> {
        return await Promise.all(
            messages.map(async (message) => ({
                ...message,
                content: await this.redactText(message.content),
            }))
        );
    }

    async redactChatInput<T extends ChatInputWithPrompt>(input: T): Promise<T> {
        return {
            ...input,
            prompt: input.prompt === undefined ? undefined : await this.redactText(input.prompt),
            messages: input.messages === undefined ? undefined : await this.redactMessages(input.messages),
        };
    }
}

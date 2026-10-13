import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type ComprehendClientConfig,
    type LanguageCode,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";

type ComprehendClientLike = {
    send(command: DetectPiiEntitiesCommand): Promise<{ Entities?: PiiEntity[] }>;
};

type RedactionTokenFactory = (entity: NormalizedPiiEntity) => string;

export interface AwsComprehendRedactorOptions {
    client?: ComprehendClientLike;
    region?: string;
    credentials?: ComprehendClientConfig["credentials"];
    languageCode?: LanguageCode | string;
    confidenceThreshold?: number;
    piiEntityTypes?: string[];
    redactionToken?: string | RedactionTokenFactory;
}

export interface AwsComprehendRedactOptions {
    languageCode?: LanguageCode | string;
    confidenceThreshold?: number;
    piiEntityTypes?: string[];
    redactionToken?: string | RedactionTokenFactory;
}

export interface NormalizedPiiEntity {
    beginOffset: number;
    endOffset: number;
    type: string;
    score: number;
}

type ChatLikeOptions = {
    prompt?: string;
    messages?: Array<{ content?: string; [key: string]: unknown }>;
    [key: string]: unknown;
};

type ChatEndpoint<TOptions extends ChatLikeOptions, TResult> = {
    chat(options: TOptions): TResult | Promise<TResult>;
};

const DEFAULT_LANGUAGE_CODE = "en";
const DEFAULT_REGION = "us-east-1";
const DEFAULT_REDACTION_TOKEN = "[REDACTED]";

export class AwsComprehendRedactor {
    private readonly client: ComprehendClientLike;
    private readonly defaults: Required<
        Pick<AwsComprehendRedactorOptions, "confidenceThreshold" | "languageCode">
    > &
        Pick<AwsComprehendRedactorOptions, "piiEntityTypes" | "redactionToken">;

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.client =
            options.client ||
            new ComprehendClient({
                region: options.region || process.env.AWS_REGION || DEFAULT_REGION,
                credentials: options.credentials,
            });
        this.defaults = {
            languageCode: options.languageCode || DEFAULT_LANGUAGE_CODE,
            confidenceThreshold: options.confidenceThreshold ?? 0,
            piiEntityTypes: options.piiEntityTypes,
            redactionToken: options.redactionToken,
        };
    }

    async detectPiiEntities(
        text: string,
        options: AwsComprehendRedactOptions = {}
    ): Promise<NormalizedPiiEntity[]> {
        if (!text) return [];

        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: this.getLanguageCode(options),
            })
        );

        return (response.Entities || [])
            .map((entity) => this.normalizeEntity(entity))
            .filter((entity): entity is NormalizedPiiEntity => Boolean(entity))
            .filter((entity) => this.shouldRedactEntity(entity, options));
    }

    async redactText(text: string, options: AwsComprehendRedactOptions = {}): Promise<string> {
        const entities = await this.detectPiiEntities(text, options);
        return this.applyRedactions(text, entities, options);
    }

    async redactPrompt(prompt: string, options: AwsComprehendRedactOptions = {}): Promise<string> {
        return this.redactText(prompt, options);
    }

    async redactMessages<TMessage extends { content?: string }>(
        messages: TMessage[],
        options: AwsComprehendRedactOptions = {}
    ): Promise<TMessage[]> {
        return Promise.all(
            messages.map(async (message) => {
                if (typeof message.content !== "string") return message;

                return {
                    ...message,
                    content: await this.redactText(message.content, options),
                };
            })
        );
    }

    async redactChatOptions<TOptions extends ChatLikeOptions>(
        chatOptions: TOptions,
        options: AwsComprehendRedactOptions = {}
    ): Promise<TOptions> {
        const redactedOptions = { ...chatOptions };

        if (typeof redactedOptions.prompt === "string") {
            redactedOptions.prompt = await this.redactText(redactedOptions.prompt, options);
        }

        if (Array.isArray(redactedOptions.messages)) {
            redactedOptions.messages = await this.redactMessages(redactedOptions.messages, options);
        }

        return redactedOptions;
    }

    async redactAndCall<TOptions extends ChatLikeOptions, TResult>(
        endpoint: ChatEndpoint<TOptions, TResult>,
        chatOptions: TOptions,
        options: AwsComprehendRedactOptions = {}
    ): Promise<TResult> {
        const redactedOptions = await this.redactChatOptions(chatOptions, options);
        return endpoint.chat(redactedOptions);
    }

    applyRedactions(
        text: string,
        entities: NormalizedPiiEntity[],
        options: AwsComprehendRedactOptions = {}
    ): string {
        const ranges = this.mergeRanges(
            entities
                .filter((entity) => this.shouldRedactEntity(entity, options))
                .filter((entity) => this.isUsableRange(text, entity))
        );

        return ranges.reduceRight((result, entity) => {
            const token = this.getRedactionToken(entity, options);
            return `${result.slice(0, entity.beginOffset)}${token}${result.slice(
                entity.endOffset
            )}`;
        }, text);
    }

    private normalizeEntity(entity: PiiEntity): NormalizedPiiEntity | null {
        if (
            typeof entity.BeginOffset !== "number" ||
            typeof entity.EndOffset !== "number" ||
            entity.BeginOffset >= entity.EndOffset
        ) {
            return null;
        }

        return {
            beginOffset: entity.BeginOffset,
            endOffset: entity.EndOffset,
            type: entity.Type || "PII",
            score: entity.Score ?? 0,
        };
    }

    private shouldRedactEntity(
        entity: NormalizedPiiEntity,
        options: AwsComprehendRedactOptions
    ): boolean {
        const confidenceThreshold =
            options.confidenceThreshold ?? this.defaults.confidenceThreshold;
        const piiEntityTypes = options.piiEntityTypes || this.defaults.piiEntityTypes;

        if (entity.score < confidenceThreshold) return false;
        if (!piiEntityTypes?.length) return true;

        return piiEntityTypes.includes(entity.type);
    }

    private getLanguageCode(options: AwsComprehendRedactOptions): LanguageCode {
        return (options.languageCode || this.defaults.languageCode) as LanguageCode;
    }

    private getRedactionToken(
        entity: NormalizedPiiEntity,
        options: AwsComprehendRedactOptions
    ): string {
        const token = options.redactionToken ?? this.defaults.redactionToken;

        if (typeof token === "function") return token(entity);
        return token || DEFAULT_REDACTION_TOKEN;
    }

    private isUsableRange(text: string, entity: NormalizedPiiEntity): boolean {
        return entity.beginOffset >= 0 && entity.endOffset <= text.length;
    }

    private mergeRanges(entities: NormalizedPiiEntity[]): NormalizedPiiEntity[] {
        const sorted = [...entities].sort(
            (a, b) => a.beginOffset - b.beginOffset || b.endOffset - a.endOffset
        );
        const merged: NormalizedPiiEntity[] = [];

        for (const entity of sorted) {
            const previous = merged[merged.length - 1];

            if (!previous || entity.beginOffset >= previous.endOffset) {
                merged.push({ ...entity });
                continue;
            }

            previous.endOffset = Math.max(previous.endOffset, entity.endOffset);
            previous.score = Math.max(previous.score, entity.score);
        }

        return merged;
    }
}

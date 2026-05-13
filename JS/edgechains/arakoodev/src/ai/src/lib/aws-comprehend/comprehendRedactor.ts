import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type DetectPiiEntitiesCommandInput,
    type DetectPiiEntitiesCommandOutput,
    type LanguageCode,
    type PiiEntity,
    type PiiEntityType,
} from "@aws-sdk/client-comprehend";

type ChatMessage = {
    role: string;
    content: string;
    name?: string;
};

type ChatOptions = {
    prompt?: string;
    messages?: ChatMessage[];
    [key: string]: unknown;
};

type ChatEndpoint<TResponse> = {
    chat(options: ChatOptions): Promise<TResponse>;
};

type RedactionClient = {
    send(command: DetectPiiEntitiesCommand): Promise<DetectPiiEntitiesCommandOutput>;
};

export type AwsComprehendRedactionResult = {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
};

export interface AwsComprehendRedactorOptions {
    client?: RedactionClient;
    region?: string;
    languageCode?: LanguageCode;
    maskCharacter?: string;
    minScore?: number;
    replacementText?: string;
    piiEntityTypes?: PiiEntityType[];
}

export class AwsComprehendRedactor {
    private readonly client: RedactionClient;
    private readonly languageCode: LanguageCode;
    private readonly maskCharacter: string;
    private readonly minScore: number;
    private readonly replacementText?: string;
    private readonly piiEntityTypes?: PiiEntityType[];

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.client =
            options.client ||
            new ComprehendClient({
                region: options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
            });
        this.languageCode = options.languageCode || "en";
        this.maskCharacter = options.maskCharacter || "*";
        this.minScore = options.minScore ?? 0;
        this.replacementText = options.replacementText;
        this.piiEntityTypes = options.piiEntityTypes;
    }

    async redact(text: string): Promise<AwsComprehendRedactionResult> {
        if (!text) {
            return { originalText: text, redactedText: text, entities: [] };
        }

        const input: DetectPiiEntitiesCommandInput = {
            Text: text,
            LanguageCode: this.languageCode,
        };
        const response = await this.client.send(new DetectPiiEntitiesCommand(input));
        const entities = (response.Entities || [])
            .filter((entity) => this.shouldRedact(entity))
            .sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));

        return {
            originalText: text,
            redactedText: this.replaceEntities(text, entities),
            entities,
        };
    }

    async redactChatOptions<TOptions extends ChatOptions>(chatOptions: TOptions): Promise<TOptions> {
        const redactedOptions = { ...chatOptions };

        if (typeof chatOptions.prompt === "string") {
            redactedOptions.prompt = (await this.redact(chatOptions.prompt)).redactedText;
        }

        if (chatOptions.messages) {
            redactedOptions.messages = await Promise.all(
                chatOptions.messages.map(async (message) => ({
                    ...message,
                    content: (await this.redact(message.content)).redactedText,
                }))
            );
        }

        return redactedOptions;
    }

    async chat<TResponse>(
        endpoint: ChatEndpoint<TResponse>,
        chatOptions: ChatOptions
    ): Promise<TResponse> {
        return endpoint.chat(await this.redactChatOptions(chatOptions));
    }

    private shouldRedact(entity: PiiEntity): boolean {
        if ((entity.Score || 0) < this.minScore) return false;
        if (!this.piiEntityTypes?.length) return true;
        return Boolean(entity.Type && this.piiEntityTypes.includes(entity.Type));
    }

    private replaceEntities(text: string, entities: PiiEntity[]): string {
        return entities.reduce((redacted, entity) => {
            const begin = entity.BeginOffset ?? 0;
            const end = entity.EndOffset ?? begin;
            const replacement =
                this.replacementText || this.maskCharacter.repeat(Math.max(end - begin, 0));
            return redacted.slice(0, begin) + replacement + redacted.slice(end);
        }, text);
    }
}

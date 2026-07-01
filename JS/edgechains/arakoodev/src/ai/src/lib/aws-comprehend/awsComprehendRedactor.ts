import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type DetectPiiEntitiesCommandOutput,
    type LanguageCode,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";

type ChatMessage = {
    content: string;
    [key: string]: unknown;
};

type PromptInput = {
    prompt?: string;
    messages?: ChatMessage[];
    [key: string]: unknown;
};

type ComprehendLikeClient = {
    send(command: DetectPiiEntitiesCommand): Promise<DetectPiiEntitiesCommandOutput>;
};

type RedactionResult = {
    content: string;
    entities: PiiEntity[];
};

type AwsComprehendRedactorOptions = {
    client?: ComprehendLikeClient;
    region?: string;
    languageCode?: LanguageCode;
    replacement?: string;
    replacementForType?: (entity: PiiEntity) => string;
};

export class AwsComprehendRedactor {
    private client: ComprehendLikeClient;
    private languageCode: LanguageCode;
    private replacement: string;
    private replacementForType?: (entity: PiiEntity) => string;

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.client =
            options.client ||
            new ComprehendClient({
                region: options.region || process.env.AWS_REGION || "us-east-1",
            });
        this.languageCode = options.languageCode || "en";
        this.replacement = options.replacement || "[REDACTED]";
        this.replacementForType = options.replacementForType;
    }

    async redactText(text: string): Promise<RedactionResult> {
        if (!text) {
            return { content: text, entities: [] };
        }

        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: this.languageCode,
            })
        );
        const entities = (response.Entities || []).filter(hasOffsets);

        return {
            content: redactByOffsets(text, entities, (entity) => this.maskFor(entity)),
            entities,
        };
    }

    async redactPrompt<T extends PromptInput>(input: T): Promise<T> {
        const nextInput = { ...input };
        if (typeof input.prompt === "string") {
            nextInput.prompt = (await this.redactText(input.prompt)).content;
        }
        if (Array.isArray(input.messages)) {
            nextInput.messages = await Promise.all(
                input.messages.map(async (message) => ({
                    ...message,
                    content:
                        typeof message.content === "string"
                            ? (await this.redactText(message.content)).content
                            : message.content,
                }))
            );
        }
        return nextInput;
    }

    async chain<T extends PromptInput, R>(input: T, next: (redactedInput: T) => Promise<R>): Promise<R> {
        return next(await this.redactPrompt(input));
    }

    private maskFor(entity: PiiEntity): string {
        if (this.replacementForType) {
            return this.replacementForType(entity);
        }
        return entity.Type ? `[REDACTED_${entity.Type}]` : this.replacement;
    }
}

function hasOffsets(entity: PiiEntity): entity is PiiEntity & { BeginOffset: number; EndOffset: number } {
    return typeof entity.BeginOffset === "number" && typeof entity.EndOffset === "number";
}

function redactByOffsets(
    text: string,
    entities: Array<PiiEntity & { BeginOffset: number; EndOffset: number }>,
    maskFor: (entity: PiiEntity) => string
): string {
    return [...entities]
        .sort((a, b) => b.BeginOffset - a.BeginOffset)
        .reduce((content, entity) => {
            if (entity.BeginOffset < 0 || entity.EndOffset > content.length || entity.BeginOffset >= entity.EndOffset) {
                return content;
            }
            return content.slice(0, entity.BeginOffset) + maskFor(entity) + content.slice(entity.EndOffset);
        }, text);
}

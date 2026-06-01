import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type DetectPiiEntitiesCommandOutput,
    type LanguageCode,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";

export interface ComprehendPiiRedactorClient {
    send(
        command: DetectPiiEntitiesCommand,
    ): Promise<DetectPiiEntitiesCommandOutput>;
}

export interface RedactableMessage {
    role: string;
    content: string;
    name?: string;
}

export interface RedactableChatOptions {
    prompt?: string;
    messages?: RedactableMessage[];
    [key: string]: unknown;
}

export interface ChatEndpoint<TOptions extends RedactableChatOptions, TResult> {
    chat(options: TOptions): Promise<TResult>;
}

export interface ComprehendPiiRedactorOptions {
    client?: ComprehendPiiRedactorClient;
    languageCode?: LanguageCode;
    maxConcurrency?: number;
    replacementForEntity?: (entity: PiiEntity) => string;
    region?: string;
}

export class ComprehendPiiRedactor {
    private client: ComprehendPiiRedactorClient;
    private languageCode: LanguageCode;
    private maxConcurrency: number;
    private replacementForEntity: (entity: PiiEntity) => string;

    constructor(options: ComprehendPiiRedactorOptions = {}) {
        this.client =
            options.client ||
            new ComprehendClient({
                region:
                    options.region ||
                    process.env.AWS_REGION ||
                    process.env.AWS_DEFAULT_REGION ||
                    "us-east-1",
            });
        this.languageCode = options.languageCode || "en";
        this.maxConcurrency = Math.max(1, options.maxConcurrency || 1);
        this.replacementForEntity =
            options.replacementForEntity ||
            ((entity) => `[${entity.Type || "PII"}]`);
    }

    async redactText(text: string): Promise<string> {
        if (!text) return text;

        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: this.languageCode,
            }),
        );

        return this.applyRedactions(text, response.Entities || []);
    }

    async redactMessages<TMessage extends RedactableMessage>(
        messages: TMessage[],
    ): Promise<TMessage[]> {
        return this.mapWithConcurrency(messages, async (message) => ({
            ...message,
            content: await this.redactText(message.content),
        }));
    }

    async redactChatOptions<TOptions extends RedactableChatOptions>(
        options: TOptions,
    ): Promise<TOptions> {
        const redactedOptions = { ...options };

        if (typeof options.prompt === "string") {
            redactedOptions.prompt = await this.redactText(options.prompt);
        }

        if (options.messages) {
            redactedOptions.messages = await this.redactMessages(
                options.messages,
            );
        }

        return redactedOptions;
    }

    wrap<TOptions extends RedactableChatOptions, TResult>(
        endpoint: ChatEndpoint<TOptions, TResult>,
    ): ChatEndpoint<TOptions, TResult> {
        return {
            chat: async (options: TOptions) =>
                endpoint.chat(await this.redactChatOptions(options)),
        };
    }

    pipe<TOptions extends RedactableChatOptions, TResult>(
        endpoint: ChatEndpoint<TOptions, TResult>,
    ): ChatEndpoint<TOptions, TResult> {
        return this.wrap(endpoint);
    }

    private async mapWithConcurrency<TItem, TResult>(
        items: TItem[],
        mapper: (item: TItem) => Promise<TResult>,
    ): Promise<TResult[]> {
        const results: TResult[] = [];
        let nextIndex = 0;
        const workerCount = Math.min(this.maxConcurrency, items.length);
        const workers = Array.from({ length: workerCount }, async () => {
            while (nextIndex < items.length) {
                const currentIndex = nextIndex;
                nextIndex += 1;
                results[currentIndex] = await mapper(items[currentIndex]);
            }
        });

        await Promise.all(workers);

        return results;
    }

    private applyRedactions(text: string, entities: PiiEntity[]): string {
        const codePoints = Array.from(text);

        return entities
            .filter(
                (
                    entity,
                ): entity is PiiEntity & {
                    BeginOffset: number;
                    EndOffset: number;
                } =>
                    typeof entity.BeginOffset === "number" &&
                    typeof entity.EndOffset === "number" &&
                    entity.BeginOffset < entity.EndOffset &&
                    entity.EndOffset <= codePoints.length,
            )
            .sort((left, right) => right.BeginOffset - left.BeginOffset)
            .reduce((redactedCodePoints, entity) => {
                redactedCodePoints.splice(
                    entity.BeginOffset,
                    entity.EndOffset - entity.BeginOffset,
                    this.replacementForEntity(entity),
                );

                return redactedCodePoints;
            }, codePoints)
            .join("");
    }
}

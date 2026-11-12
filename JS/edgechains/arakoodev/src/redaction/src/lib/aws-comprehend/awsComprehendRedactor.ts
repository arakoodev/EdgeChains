import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type ComprehendClientConfig,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";

export type AwsComprehendRedactionMask = string | ((entity: PiiEntity) => string);

export interface AwsComprehendRedactorOptions {
    client?: ComprehendClient;
    clientConfig?: ComprehendClientConfig;
    languageCode?: "en" | "es";
    mask?: AwsComprehendRedactionMask;
}

export interface AwsComprehendRedactionResult {
    text: string;
    redactedText: string;
    entities: PiiEntity[];
}

export interface RedactableMessage {
    content: string;
    [key: string]: unknown;
}

export interface RedactablePromptOptions {
    prompt?: string;
    messages?: RedactableMessage[];
    [key: string]: unknown;
}

export class AwsComprehendRedactor {
    private readonly client: ComprehendClient;
    private readonly languageCode: "en" | "es";
    private readonly mask: AwsComprehendRedactionMask;

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.client = options.client ?? new ComprehendClient(options.clientConfig ?? {});
        this.languageCode = options.languageCode ?? "en";
        this.mask = options.mask ?? ((entity: PiiEntity): string => `[${entity.Type ?? "PII"}]`);
    }

    async redact(text: string): Promise<AwsComprehendRedactionResult> {
        if (!text.trim()) {
            return {
                text,
                redactedText: text,
                entities: [],
            };
        }

        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: this.languageCode,
            })
        );
        const entities = response.Entities ?? [];

        return {
            text,
            redactedText: this.applyRedactions(text, entities),
            entities,
        };
    }

    async transform(text: string): Promise<string> {
        const result = await this.redact(text);
        return result.redactedText;
    }

    async run(text: string): Promise<string> {
        return this.transform(text);
    }

    async redactPromptOptions<T extends RedactablePromptOptions>(options: T): Promise<T> {
        const prompt = options.prompt ? await this.transform(options.prompt) : options.prompt;
        const messages = options.messages
            ? await Promise.all(
                  options.messages.map(async (message) => ({
                      ...message,
                      content: await this.transform(message.content),
                  }))
              )
            : options.messages;

        return {
            ...options,
            ...(prompt === undefined ? {} : { prompt }),
            ...(messages === undefined ? {} : { messages }),
        };
    }

    private applyRedactions(text: string, entities: PiiEntity[]): string {
        return [...entities]
            .filter((entity): entity is PiiEntity & { BeginOffset: number; EndOffset: number } => {
                return (
                    typeof entity.BeginOffset === "number" &&
                    typeof entity.EndOffset === "number" &&
                    entity.BeginOffset >= 0 &&
                    entity.EndOffset <= text.length &&
                    entity.BeginOffset < entity.EndOffset
                );
            })
            .sort((a, b) => b.BeginOffset - a.BeginOffset)
            .reduce((redactedText, entity) => {
                const replacement =
                    typeof this.mask === "function" ? this.mask(entity) : this.mask;
                return (
                    redactedText.slice(0, entity.BeginOffset) +
                    replacement +
                    redactedText.slice(entity.EndOffset)
                );
            }, text);
    }
}

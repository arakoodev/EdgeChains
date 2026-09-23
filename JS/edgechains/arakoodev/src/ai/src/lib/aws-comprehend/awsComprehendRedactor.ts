export type PiiEntityType =
    | "BANK_ACCOUNT_NUMBER"
    | "BANK_ROUTING"
    | "CREDIT_DEBIT_NUMBER"
    | "CREDIT_DEBIT_CVV"
    | "CREDIT_DEBIT_EXPIRY"
    | "PIN"
    | "EMAIL"
    | "ADDRESS"
    | "NAME"
    | "PHONE"
    | "SSN"
    | "DATE_TIME"
    | "PASSPORT_NUMBER"
    | "DRIVER_ID"
    | "URL"
    | "AGE"
    | "USERNAME"
    | "PASSWORD"
    | "AWS_ACCESS_KEY"
    | "AWS_SECRET_KEY"
    | "IP_ADDRESS"
    | "MAC_ADDRESS"
    | "ALL";

export interface ComprehendPiiEntity {
    Type?: PiiEntityType | string;
    Score?: number;
    BeginOffset?: number;
    EndOffset?: number;
}

export interface DetectPiiEntitiesResponse {
    Entities?: ComprehendPiiEntity[];
}

export interface DetectPiiEntitiesInput {
    Text: string;
    LanguageCode: string;
}

export interface ComprehendClientLike {
    detectPiiEntities?: (input: DetectPiiEntitiesInput) => Promise<DetectPiiEntitiesResponse>;
    send?: (command: unknown) => Promise<DetectPiiEntitiesResponse>;
}

export interface AwsComprehendRedactorOptions {
    client: ComprehendClientLike;
    detectPiiEntitiesCommand?: new (input: DetectPiiEntitiesInput) => unknown;
    languageCode?: string;
    minScore?: number;
    replacement?: string | ((entity: ComprehendPiiEntity, value: string) => string);
}

export class AwsComprehendRedactor {
    private client: ComprehendClientLike;
    private detectPiiEntitiesCommand?: new (input: DetectPiiEntitiesInput) => unknown;
    private languageCode: string;
    private minScore: number;
    private replacement: string | ((entity: ComprehendPiiEntity, value: string) => string);

    constructor(options: AwsComprehendRedactorOptions) {
        this.client = options.client;
        this.detectPiiEntitiesCommand = options.detectPiiEntitiesCommand;
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0;
        this.replacement = options.replacement || ((entity) => `[${entity.Type || "PII"}]`);
    }

    async redact(text: string): Promise<string> {
        if (!text) {
            return text;
        }

        const response = await this.detectPiiEntities(text);
        const entities = (response.Entities || [])
            .filter((entity) => {
                return (
                    typeof entity.BeginOffset === "number" &&
                    typeof entity.EndOffset === "number" &&
                    entity.BeginOffset < entity.EndOffset &&
                    (entity.Score ?? 1) >= this.minScore
                );
            })
            .sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));

        return entities.reduce((redactedText, entity) => {
            const start = entity.BeginOffset || 0;
            const end = entity.EndOffset || 0;
            const value = redactedText.slice(start, end);
            const replacement =
                typeof this.replacement === "function"
                    ? this.replacement(entity, value)
                    : this.replacement;

            return redactedText.slice(0, start) + replacement + redactedText.slice(end);
        }, text);
    }

    async redactPrompt<T extends { prompt?: string; messages?: Array<{ content?: string }> }>(
        promptOptions: T
    ): Promise<T> {
        const clonedOptions = {
            ...promptOptions,
            messages: promptOptions.messages
                ? await Promise.all(
                      promptOptions.messages.map(async (message) => ({
                          ...message,
                          content: message.content ? await this.redact(message.content) : message.content,
                      }))
                  )
                : promptOptions.messages,
        };

        if (promptOptions.prompt) {
            clonedOptions.prompt = await this.redact(promptOptions.prompt);
        }

        return clonedOptions;
    }

    private async detectPiiEntities(text: string): Promise<DetectPiiEntitiesResponse> {
        const input = {
            Text: text,
            LanguageCode: this.languageCode,
        };

        if (this.client.detectPiiEntities) {
            return this.client.detectPiiEntities(input);
        }

        if (this.client.send && this.detectPiiEntitiesCommand) {
            return this.client.send(new this.detectPiiEntitiesCommand(input));
        }

        throw new Error(
            "AwsComprehendRedactor requires either client.detectPiiEntities or client.send with detectPiiEntitiesCommand"
        );
    }
}

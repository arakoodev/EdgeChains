export type ComprehendPiiEntityType =
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
    Type: ComprehendPiiEntityType;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface DetectPiiEntitiesResponse {
    Entities: ComprehendPiiEntity[];
}

export interface ComprehendClient {
    detectPiiEntities(text: string, languageCode: string): Promise<DetectPiiEntitiesResponse>;
}

export interface AWSComprehendRedactorOptions {
    client: ComprehendClient;
    languageCode?: string;
    minScore?: number;
    replacement?: "placeholder" | "mask";
    allowedTypes?: ComprehendPiiEntityType[];
}

export interface EndpointLike<TInput, TOutput> {
    chat(options: TInput): Promise<TOutput>;
}

export interface ObservableLike<T> {
    subscribe(observer: (value: T) => void): unknown;
}

export class AWSComprehendRedactor {
    private readonly client: ComprehendClient;
    private readonly languageCode: string;
    private readonly minScore: number;
    private readonly replacement: "placeholder" | "mask";
    private readonly allowedTypes?: Set<ComprehendPiiEntityType>;

    constructor(options: AWSComprehendRedactorOptions) {
        this.client = options.client;
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0;
        this.replacement = options.replacement || "placeholder";
        this.allowedTypes = options.allowedTypes ? new Set(options.allowedTypes) : undefined;
    }

    async redactText(text: string): Promise<string> {
        const response = await this.client.detectPiiEntities(text, this.languageCode);
        const entities = response.Entities.filter((entity) => this.shouldRedact(entity)).sort(
            (a, b) => b.BeginOffset - a.BeginOffset
        );

        return entities.reduce((redacted, entity) => {
            const replacement =
                this.replacement === "mask"
                    ? "*".repeat(entity.EndOffset - entity.BeginOffset)
                    : `[${entity.Type}]`;
            return redacted.slice(0, entity.BeginOffset) + replacement + redacted.slice(entity.EndOffset);
        }, text);
    }

    async redactPromptOptions<T extends { prompt?: string; messages?: Array<{ content: string }> }>(
        options: T
    ): Promise<T> {
        const nextOptions = { ...options };
        if (nextOptions.prompt) {
            nextOptions.prompt = await this.redactText(nextOptions.prompt);
        }
        if (nextOptions.messages) {
            nextOptions.messages = await Promise.all(
                nextOptions.messages.map(async (message) => ({
                    ...message,
                    content: await this.redactText(message.content),
                }))
            );
        }
        return nextOptions;
    }

    chainEndpoint<TInput extends { prompt?: string; messages?: Array<{ content: string }> }, TOutput>(
        endpoint: EndpointLike<TInput, TOutput>
    ): EndpointLike<TInput, TOutput> {
        return {
            chat: async (options: TInput) => endpoint.chat(await this.redactPromptOptions(options)),
        };
    }

    mapObservable<T extends { prompt?: string; messages?: Array<{ content: string }> }>(
        source: ObservableLike<T>
    ): ObservableLike<Promise<T>> {
        return {
            subscribe: (observer: (value: Promise<T>) => void) =>
                source.subscribe((value) => observer(this.redactPromptOptions(value))),
        };
    }

    private shouldRedact(entity: ComprehendPiiEntity): boolean {
        if (entity.Score < this.minScore) {
            return false;
        }
        return !this.allowedTypes || this.allowedTypes.has(entity.Type);
    }
}

type ComprehendPiiEntity = {
    Type?: string;
    BeginOffset?: number;
    EndOffset?: number;
    Score?: number;
};

type DetectPiiEntitiesResult = {
    Entities?: ComprehendPiiEntity[];
};

type DetectPiiEntitiesInput = {
    Text: string;
    LanguageCode: string;
};

type AwsComprehendClient = {
    detectPiiEntities?: (input: DetectPiiEntitiesInput) => Promise<DetectPiiEntitiesResult>;
    send?: (command: unknown) => Promise<DetectPiiEntitiesResult>;
};

type ChatEndpoint<TChatOptions, TChatResult> = {
    chat(options: TChatOptions): Promise<TChatResult>;
};

type Message = {
    role?: string;
    content?: string;
    [key: string]: unknown;
};

export type RedactionMode = "replace" | "mask";

export interface ComprehendPiiRedactorOptions {
    client: AwsComprehendClient;
    languageCode?: string;
    placeholder?: (entityType: string) => string;
    minScore?: number;
    mode?: RedactionMode;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: Required<Pick<ComprehendPiiEntity, "Type" | "BeginOffset" | "EndOffset">>[];
}

export class DetectPiiEntitiesCommand {
    input: DetectPiiEntitiesInput;

    constructor(input: DetectPiiEntitiesInput) {
        this.input = input;
    }
}

export class ComprehendPiiRedactor {
    private client: AwsComprehendClient;
    private languageCode: string;
    private placeholder: (entityType: string) => string;
    private minScore: number;
    private mode: RedactionMode;

    constructor(options: ComprehendPiiRedactorOptions) {
        this.client = options.client;
        this.languageCode = options.languageCode || "en";
        this.placeholder = options.placeholder || ((entityType) => `[REDACTED_${entityType}]`);
        this.minScore = options.minScore ?? 0;
        this.mode = options.mode || "replace";
    }

    async redact(text: string): Promise<RedactionResult> {
        const response = await this.detectPiiEntities(text);
        const entities = (response.Entities || [])
            .filter((entity) => this.isUsableEntity(entity))
            .map((entity) => ({
                Type: entity.Type as string,
                BeginOffset: entity.BeginOffset as number,
                EndOffset: entity.EndOffset as number,
            }))
            .sort((a, b) => b.BeginOffset - a.BeginOffset);

        let redactedText = text;
        for (const entity of entities) {
            const value =
                this.mode === "mask"
                    ? "*".repeat(Math.max(0, entity.EndOffset - entity.BeginOffset))
                    : this.placeholder(entity.Type);
            redactedText =
                redactedText.slice(0, entity.BeginOffset) + value + redactedText.slice(entity.EndOffset);
        }

        return {
            originalText: text,
            redactedText,
            entities,
        };
    }

    wrap<TChatOptions extends { prompt?: string; messages?: Message[] }, TChatResult>(
        endpoint: ChatEndpoint<TChatOptions, TChatResult>
    ): ChatEndpoint<TChatOptions, TChatResult> {
        return {
            chat: async (options: TChatOptions) => {
                return endpoint.chat(await this.redactChatOptions(options));
            },
        };
    }

    async redactChatOptions<TChatOptions extends { prompt?: string; messages?: Message[] }>(
        options: TChatOptions
    ): Promise<TChatOptions> {
        const nextOptions = { ...options };

        if (typeof nextOptions.prompt === "string") {
            nextOptions.prompt = (await this.redact(nextOptions.prompt)).redactedText;
        }

        if (Array.isArray(nextOptions.messages)) {
            nextOptions.messages = await Promise.all(
                nextOptions.messages.map(async (message) => {
                    if (typeof message.content !== "string") return message;
                    return {
                        ...message,
                        content: (await this.redact(message.content)).redactedText,
                    };
                })
            );
        }

        return nextOptions;
    }

    private async detectPiiEntities(text: string): Promise<DetectPiiEntitiesResult> {
        const input = { Text: text, LanguageCode: this.languageCode };

        if (this.client.detectPiiEntities) {
            return this.client.detectPiiEntities(input);
        }

        if (this.client.send) {
            return this.client.send(new DetectPiiEntitiesCommand(input));
        }

        throw new Error("Comprehend client must implement detectPiiEntities(input) or send(command).");
    }

    private isUsableEntity(entity: ComprehendPiiEntity): boolean {
        return (
            typeof entity.Type === "string" &&
            typeof entity.BeginOffset === "number" &&
            typeof entity.EndOffset === "number" &&
            entity.EndOffset > entity.BeginOffset &&
            (entity.Score ?? 1) >= this.minScore
        );
    }
}

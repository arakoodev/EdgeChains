type ComprehendLanguageCode =
    | "en"
    | "es"
    | "fr"
    | "de"
    | "it"
    | "pt"
    | "ar"
    | "hi"
    | "ja"
    | "ko"
    | "zh"
    | "zh-TW";

type PiiEntityType =
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

interface DetectPiiEntitiesResponse {
    Entities?: ComprehendPiiEntity[];
}

export interface ComprehendClientLike {
    send(command: unknown): Promise<DetectPiiEntitiesResponse>;
}

interface DetectPiiEntitiesCommandCtor {
    new (input: { Text: string; LanguageCode: ComprehendLanguageCode }): unknown;
}

interface AwsComprehendModule {
    ComprehendClient: new (options: {
        region?: string;
        credentials?: AwsComprehendRedactorOptions["credentials"];
    }) => ComprehendClientLike;
    DetectPiiEntitiesCommand: DetectPiiEntitiesCommandCtor;
}

export interface AwsComprehendRedactorOptions {
    client?: ComprehendClientLike;
    commandCtor?: DetectPiiEntitiesCommandCtor;
    region?: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    };
    languageCode?: ComprehendLanguageCode;
    entityTypes?: Array<PiiEntityType | string>;
    minScore?: number;
    mask?: string;
}

export interface RedactTextResult {
    text: string;
    entities: ComprehendPiiEntity[];
}

export interface ChatMessage {
    role: string;
    content: string;
    name?: string;
}

export class AwsComprehendRedactor {
    private readonly client?: ComprehendClientLike;
    private readonly commandCtor?: DetectPiiEntitiesCommandCtor;
    private readonly region?: string;
    private readonly credentials?: AwsComprehendRedactorOptions["credentials"];
    private readonly languageCode: ComprehendLanguageCode;
    private readonly entityTypes?: Set<string>;
    private readonly minScore: number;
    private readonly mask: string;

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.client = options.client;
        this.commandCtor = options.commandCtor;
        this.region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
        this.credentials = options.credentials;
        this.languageCode = options.languageCode || "en";
        this.entityTypes = options.entityTypes ? new Set(options.entityTypes) : undefined;
        this.minScore = options.minScore ?? 0;
        this.mask = options.mask || "[REDACTED:{type}]";
    }

    async detectPiiEntities(text: string): Promise<ComprehendPiiEntity[]> {
        if (!text) {
            return [];
        }

        const { client, commandCtor } = await this.getClientAndCommand();
        const command = new commandCtor({
            Text: text,
            LanguageCode: this.languageCode,
        });
        const response = await client.send(command);
        return (response.Entities || []).filter((entity) => this.shouldRedact(entity));
    }

    async redactText(text: string): Promise<RedactTextResult> {
        const entities = await this.detectPiiEntities(text);
        return {
            text: redactByOffsets(text, entities, this.mask),
            entities,
        };
    }

    async redactPrompt(prompt: string): Promise<string> {
        return (await this.redactText(prompt)).text;
    }

    async redactMessages(messages: ChatMessage[]): Promise<ChatMessage[]> {
        return Promise.all(
            messages.map(async (message) => ({
                ...message,
                content: await this.redactPrompt(message.content),
            }))
        );
    }

    asPromptRedactor(): (prompt: string) => Promise<string> {
        return (prompt: string) => this.redactPrompt(prompt);
    }

    private shouldRedact(entity: ComprehendPiiEntity): boolean {
        const score = entity.Score ?? 0;
        const type = entity.Type || "";
        if (score < this.minScore) {
            return false;
        }
        if (!this.entityTypes || this.entityTypes.has("ALL")) {
            return true;
        }
        return this.entityTypes.has(type);
    }

    private async getClientAndCommand(): Promise<{
        client: ComprehendClientLike;
        commandCtor: DetectPiiEntitiesCommandCtor;
    }> {
        if (this.client && this.commandCtor) {
            return {
                client: this.client,
                commandCtor: this.commandCtor,
            };
        }

        const awsComprehend = (await import("@aws-sdk/client-comprehend")) as AwsComprehendModule;
        return {
            client: this.client || new awsComprehend.ComprehendClient({
                region: this.region,
                credentials: this.credentials,
            }),
            commandCtor: this.commandCtor || awsComprehend.DetectPiiEntitiesCommand,
        };
    }
}

export function redactByOffsets(
    text: string,
    entities: ComprehendPiiEntity[],
    mask = "[REDACTED:{type}]"
): string {
    return entities
        .filter(
            (entity) =>
                Number.isInteger(entity.BeginOffset) &&
                Number.isInteger(entity.EndOffset) &&
                entity.BeginOffset! >= 0 &&
                entity.EndOffset! > entity.BeginOffset! &&
                entity.EndOffset! <= text.length
        )
        .sort((a, b) => b.BeginOffset! - a.BeginOffset!)
        .reduce((redactedText, entity) => {
            const replacement = mask.replace("{type}", entity.Type || "PII");
            return (
                redactedText.slice(0, entity.BeginOffset) +
                replacement +
                redactedText.slice(entity.EndOffset)
            );
        }, text);
}

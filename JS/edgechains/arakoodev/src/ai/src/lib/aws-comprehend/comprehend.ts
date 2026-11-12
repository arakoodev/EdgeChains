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
        .map((entity) => {
            if (!Number.isInteger(entity.BeginOffset) || !Number.isInteger(entity.EndOffset)) {
                return undefined;
            }

            const begin = codePointOffsetToCodeUnitIndex(text, entity.BeginOffset!);
            const end = codePointOffsetToCodeUnitIndex(text, entity.EndOffset!);

            if (begin < 0 || end <= begin) {
                return undefined;
            }

            return {
                begin,
                end,
                type: entity.Type || "PII",
            };
        })
        .filter((range): range is { begin: number; end: number; type: string } => Boolean(range))
        .sort((a, b) => b.begin - a.begin)
        .reduce((redactedText, range) => {
            const replacement = mask.replace("{type}", range.type);
            return (
                redactedText.slice(0, range.begin) + replacement + redactedText.slice(range.end)
            );
        }, text);
}

function codePointOffsetToCodeUnitIndex(text: string, offset: number): number {
    if (offset < 0) {
        return -1;
    }
    if (offset === 0) {
        return 0;
    }

    let codePointIndex = 0;
    for (let codeUnitIndex = 0; codeUnitIndex < text.length; codePointIndex += 1) {
        if (codePointIndex === offset) {
            return codeUnitIndex;
        }

        const codePoint = text.codePointAt(codeUnitIndex);
        codeUnitIndex += codePoint && codePoint > 0xffff ? 2 : 1;

        if (codePointIndex + 1 === offset) {
            return codeUnitIndex;
        }
    }

    return codePointIndex === offset ? text.length : -1;
}

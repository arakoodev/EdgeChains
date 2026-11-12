export type AwsComprehendPiiEntityType =
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

export interface AwsComprehendPiiEntity {
    Type?: AwsComprehendPiiEntityType | string;
    BeginOffset?: number;
    EndOffset?: number;
    Score?: number;
}

export interface AwsComprehendDetectPiiResponse {
    Entities?: AwsComprehendPiiEntity[];
}

export interface AwsComprehendDetectPiiClient {
    detectPiiEntities(input: {
        Text: string;
        LanguageCode: string;
    }): Promise<AwsComprehendDetectPiiResponse> | AwsComprehendDetectPiiResponse;
}

export interface AwsComprehendCommandClient {
    send(command: unknown): Promise<AwsComprehendDetectPiiResponse> | AwsComprehendDetectPiiResponse;
}

export type AwsComprehendCommandFactory = new (input: {
    Text: string;
    LanguageCode: string;
}) => unknown;

export interface AwsComprehendRedactorOptions {
    client: AwsComprehendDetectPiiClient | AwsComprehendCommandClient;
    languageCode?: string;
    commandFactory?: AwsComprehendCommandFactory;
    minScore?: number;
    replacement?: string | ((entity: AwsComprehendPiiEntity) => string);
    entityTypes?: AwsComprehendPiiEntityType[] | string[];
}

export interface RedactPiiOptions {
    languageCode?: string;
    minScore?: number;
    replacement?: string | ((entity: AwsComprehendPiiEntity) => string);
    entityTypes?: AwsComprehendPiiEntityType[] | string[];
}

export interface RedactPiiResult {
    redactedText: string;
    entities: AwsComprehendPiiEntity[];
}

function hasDetectPiiEntities(client: unknown): client is AwsComprehendDetectPiiClient {
    return typeof (client as AwsComprehendDetectPiiClient).detectPiiEntities === "function";
}

function hasSend(client: unknown): client is AwsComprehendCommandClient {
    return typeof (client as AwsComprehendCommandClient).send === "function";
}

function normalizeEntity(entity: AwsComprehendPiiEntity): AwsComprehendPiiEntity | null {
    if (typeof entity.BeginOffset !== "number" || typeof entity.EndOffset !== "number") {
        return null;
    }

    if (entity.BeginOffset < 0 || entity.EndOffset <= entity.BeginOffset) {
        return null;
    }

    return entity;
}

function buildReplacement(
    replacement: string | ((entity: AwsComprehendPiiEntity) => string),
    entity: AwsComprehendPiiEntity
): string {
    return typeof replacement === "function" ? replacement(entity) : replacement;
}

export class AwsComprehendRedactor {
    private readonly client: AwsComprehendDetectPiiClient | AwsComprehendCommandClient;
    private readonly languageCode: string;
    private readonly commandFactory?: AwsComprehendCommandFactory;
    private readonly minScore: number;
    private readonly replacement: string | ((entity: AwsComprehendPiiEntity) => string);
    private readonly entityTypes?: Set<string>;

    constructor(options: AwsComprehendRedactorOptions) {
        if (!options.client) {
            throw new Error("AwsComprehendRedactor requires an AWS Comprehend client");
        }

        if (hasSend(options.client) && !options.commandFactory) {
            throw new Error("commandFactory is required when using an AWS SDK v3 send() client");
        }

        this.client = options.client;
        this.languageCode = options.languageCode || "en";
        this.commandFactory = options.commandFactory;
        this.minScore = options.minScore ?? 0;
        this.replacement = options.replacement || ((entity) => `[${entity.Type || "PII"}_REDACTED]`);
        this.entityTypes = options.entityTypes ? new Set(options.entityTypes.map((type) => String(type))) : undefined;
    }

    async detectPiiEntities(text: string, options: RedactPiiOptions = {}): Promise<AwsComprehendPiiEntity[]> {
        const input = {
            Text: text,
            LanguageCode: options.languageCode || this.languageCode,
        };

        const response = hasDetectPiiEntities(this.client)
            ? await this.client.detectPiiEntities(input)
            : await this.client.send(new this.commandFactory!(input));

        const minScore = options.minScore ?? this.minScore;
        const entityTypes = options.entityTypes ? new Set(options.entityTypes.map((type) => String(type))) : this.entityTypes;

        return (response.Entities || [])
            .map(normalizeEntity)
            .filter((entity): entity is AwsComprehendPiiEntity => Boolean(entity))
            .filter((entity) => (entity.Score ?? 1) >= minScore)
            .filter((entity) => !entityTypes || entityTypes.has(String(entity.Type)))
            .sort((left, right) => left.BeginOffset! - right.BeginOffset! || right.EndOffset! - left.EndOffset!);
    }

    async redact(text: string, options: RedactPiiOptions = {}): Promise<RedactPiiResult> {
        const detectedEntities = await this.detectPiiEntities(text, options);
        const replacement = options.replacement || this.replacement;
        const nonOverlappingEntities: AwsComprehendPiiEntity[] = [];
        let lastEndOffset = -1;

        for (const entity of detectedEntities) {
            if (entity.BeginOffset! >= lastEndOffset) {
                nonOverlappingEntities.push(entity);
                lastEndOffset = entity.EndOffset!;
            }
        }

        let cursor = 0;
        let redactedText = "";

        for (const entity of nonOverlappingEntities) {
            redactedText += text.slice(cursor, entity.BeginOffset);
            redactedText += buildReplacement(replacement, entity);
            cursor = entity.EndOffset!;
        }

        redactedText += text.slice(cursor);

        return {
            redactedText,
            entities: nonOverlappingEntities,
        };
    }
}

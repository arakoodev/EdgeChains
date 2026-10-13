/**
 * Minimal Comprehend client surface used by AWSComprehendPiiRedactor.
 * Inject a real ComprehendClient or a test double that implements `send`.
 */
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
    | "ALL"
    | string;

export interface DetectedPiiEntity {
    BeginOffset?: number;
    EndOffset?: number;
    Score?: number;
    Type?: ComprehendPiiEntityType;
}

export interface DetectPiiEntitiesCommandInput {
    Text: string;
    LanguageCode: string;
}

/** Duck-typed command object so tests never need the real AWS SDK class. */
export interface DetectPiiEntitiesCommandLike {
    input: DetectPiiEntitiesCommandInput;
}

export interface DetectPiiEntitiesResult {
    Entities?: DetectedPiiEntity[];
}

export interface ComprehendLikeClient {
    send(command: DetectPiiEntitiesCommandLike | unknown): Promise<DetectPiiEntitiesResult>;
}

export type PiiReplacementStyle = "entityType" | "mask" | "placeholder";

export type ComprehendLanguageCode =
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
    | "zh-TW"
    | string;

export interface AWSComprehendPiiRedactorOptions {
    /** Injected client (required for unit tests / offline demos). */
    client?: ComprehendLikeClient;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: ComprehendLanguageCode;
    /** Drop entities below this confidence. Default: 0.5 */
    minScore?: number;
    /** If set, only these entity types are redacted. */
    entityTypes?: ComprehendPiiEntityType[];
    replacement?: PiiReplacementStyle;
    maskCharacter?: string;
    placeholder?: (type: string) => string;
    /**
     * When true (default), AWS errors propagate and text is not passed through.
     * When false, detect failures yield an empty entity list (fail-open — not recommended for production).
     */
    failClosed?: boolean;
}

export interface ChatMessageLike {
    role?: string;
    content?: string;
    name?: string;
    [key: string]: unknown;
}

export interface ChatOptionsLike {
    prompt?: string;
    messages?: ChatMessageLike[];
    [key: string]: unknown;
}

export interface ChatEndpoint {
    chat: (opts: ChatOptionsLike) => Promise<unknown>;
}

export interface RedactObserver {
    next?: (value: string) => void;
    error?: (err: unknown) => void;
    complete?: () => void;
}

export interface RedactSubscription {
    unsubscribe(): void;
}

export interface RedactObservable {
    subscribe(observer: RedactObserver | ((value: string) => void)): RedactSubscription;
}

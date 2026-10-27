import type { LanguageCode, PiiEntity } from "@aws-sdk/client-comprehend";

/**
 * Amazon Comprehend redaction modes from the PII detection/redaction APIs.
 * @see https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/
 */
export type MaskMode = "REPLACE_WITH_PII_ENTITY_TYPE" | "MASK";

/**
 * PII entity types documented in the Amazon Comprehend PII blog / API.
 * @see https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/
 */
export const PII_ENTITY_CATEGORIES = {
    FINANCIAL: [
        "BANK_ACCOUNT_NUMBER",
        "BANK_ROUTING",
        "CREDIT_DEBIT_NUMBER",
        "CREDIT_DEBIT_CVV",
        "CREDIT_DEBIT_EXPIRY",
        "PIN",
    ],
    PERSONAL: ["NAME", "ADDRESS", "PHONE", "EMAIL", "AGE"],
    TECHNICAL_SECURITY: [
        "USERNAME",
        "PASSWORD",
        "URL",
        "AWS_ACCESS_KEY",
        "AWS_SECRET_KEY",
        "IP_ADDRESS",
        "MAC_ADDRESS",
    ],
    NATIONAL: ["SSN", "PASSPORT_NUMBER", "DRIVER_ID"],
    OTHER: ["DATE_TIME"],
} as const;

export const PII_ENTITY_TYPES = Object.values(PII_ENTITY_CATEGORIES).flat();

/** Synchronous DetectPiiEntities / ContainsPiiEntities accept at most 100 KB of UTF-8 text. */
export const DETECT_PII_ENTITIES_MAX_UTF8_BYTES = 100 * 1024;

export type ComprehendClientLike = {
    send: (command: unknown, ...rest: unknown[]) => Promise<unknown>;
};

export type RedactionReplacement = string | ((entity: PiiEntity, original: string) => string);

export interface PiiLabel {
    Name?: string;
    Score?: number;
}

export interface Utf8TextChunk {
    codePointOffset: number;
    text: string;
}

export interface AWSComprehendOptions {
    accessKeyId?: string;
    client?: ComprehendClientLike;
    entityTypes?: string[];
    languageCode?: LanguageCode | string;
    maskCharacter?: string;
    maskMode?: MaskMode;
    /**
     * Maximum UTF-8 bytes sent in one real-time Comprehend call.
     * Defaults to the 100 KB synchronous limit; longer prompts are split on
     * code-point boundaries (preferring whitespace) and offsets are rebased.
     */
    maxUtf8Bytes?: number;
    minScore?: number;
    /**
     * When true (default), `redact()` first calls `ContainsPiiEntities` and
     * only runs `DetectPiiEntities` on chunks that still look like they contain
     * in-scope PII — the two-pass pattern from the Comprehend PII blogs.
     */
    preflight?: boolean;
    region?: string;
    replacement?: RedactionReplacement;
    secretAccessKey?: string;
    sessionToken?: string;
}

export interface RedactPiiOptions {
    entityTypes?: string[];
    languageCode?: LanguageCode | string;
    maskCharacter?: string;
    maskMode?: MaskMode;
    minScore?: number;
    preflight?: boolean;
    replacement?: RedactionReplacement;
    text: string;
}

export interface ContainsPiiResult {
    containsPii: boolean;
    labels: PiiLabel[];
    text: string;
}

export interface RedactPiiResult {
    entities: PiiEntity[];
    labels: PiiLabel[];
    redactedText: string;
    skippedDetection: boolean;
    text: string;
}

export interface RedactableMessage {
    content?: string;
    role?: string;
    [key: string]: unknown;
}

export interface RedactablePromptOptions {
    input?: string | string[];
    messages?: RedactableMessage[];
    prompt?: string;
    [key: string]: unknown;
}

/**
 * One turn in a contact-center / conversation transcript.
 * @see https://aws.amazon.com/blogs/machine-learning/how-to-redact-pii-data-in-conversation-transcripts/
 */
export interface TranscriptTurn {
    speaker: string;
    text: string;
    [key: string]: unknown;
}

export interface RedactTranscriptResult {
    entities: PiiEntity[];
    labels: PiiLabel[];
    turns: TranscriptTurn[];
}

export type { LanguageCode, PiiEntity };

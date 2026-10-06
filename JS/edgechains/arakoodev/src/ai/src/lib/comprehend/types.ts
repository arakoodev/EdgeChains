import type { ComprehendClient } from "@aws-sdk/client-comprehend";

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
    | "ALL"
    | string;

export type RedactionMaskMode =
    | "ENTITY_TYPE"      // e.g. [NAME], [SSN], [PHONE]
    | "REDACTED_LABEL"   // e.g. [REDACTED]
    | "ASTERISK"         // e.g. ***
    | "CUSTOM";          // Uses customMask string or callback

export interface PiiEntity {
    score: number;
    type: PiiEntityType;
    beginOffset: number;
    endOffset: number;
    text?: string;
}

export type CustomMaskFunction = (entity: PiiEntity, originalText: string) => string;

export interface ComprehendRedactorOptions {
    /** AWS Region (e.g. 'us-east-1') */
    region?: string;
    /** Explicit AWS Credentials */
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    };
    /** Pre-configured or mocked ComprehendClient for testing and dependency injection */
    client?: ComprehendClient;
    /** Language code for PII detection. Default is 'en' */
    languageCode?: string;
    /** Minimum confidence score threshold (0.0 to 1.0). Default is 0.5 */
    minScore?: number;
    /** Whitelist of PII entity types to redact. If empty or includes 'ALL', all detected types are redacted. */
    entityTypes?: PiiEntityType[];
    /** Blacklist of PII entity types to ignore and not redact. */
    excludeEntityTypes?: PiiEntityType[];
    /** Masking format mode. Default is 'ENTITY_TYPE'. */
    maskMode?: RedactionMaskMode;
    /** Custom mask template or function when maskMode is 'CUSTOM'. Default is '[REDACTED]' */
    customMask?: string | CustomMaskFunction;
    /**
     * If true (default), throws an error if AWS Comprehend call fails to prevent data leakage.
     * If false, falls back to regex or logs warning and returns unredacted input.
     */
    failClosed?: boolean;
    /**
     * If true (default), applies regex fallback guards for critical PII (SSN, Email, Credit Cards)
     * either in conjunction with Comprehend or as failover.
     */
    enableRegexFallback?: boolean;
}

export interface RedactResult {
    /** The sanitized prompt text */
    redactedText: string;
    /** Original prompt text */
    originalText: string;
    /** Detected and redacted PII entities */
    entitiesDetected: PiiEntity[];
}

export interface EndpointLike {
    chat(options: any): Promise<any>;
    streamedChat?(options: any): Promise<any>;
    [key: string]: any;
}

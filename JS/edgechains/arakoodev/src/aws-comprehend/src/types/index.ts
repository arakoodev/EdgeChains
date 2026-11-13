/**
 * Languages supported by the Amazon Comprehend DetectPiiEntities API.
 * @see https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html
 */
export type LanguageCode =
    "en" | "es" | "fr" | "de" | "it" | "pt" | "ar" | "hi" | "ja" | "ko" | "zh" | "zh-TW";

/**
 * PII entity types returned by the Amazon Comprehend DetectPiiEntities API.
 * @see https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html
 */
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
    | "LICENSE_PLATE"
    | (string & Record<never, never>);

/**
 * A single PII entity located inside a document.
 * Character offsets are relative to the start of the whole document,
 * not to an individual AWS Comprehend chunk.
 */
export interface PiiEntity {
    type: PiiEntityType;
    score: number;
    beginOffset: number;
    endOffset: number;
}

/**
 * Subset of the AWS SDK client that this module depends on. Users can inject
 * any compatible client (for example a mock) for testing purposes.
 */
export interface CommandExecutor {
    send(command: unknown): Promise<unknown>;
}

export interface AwsCredentials {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
}

export interface ComprehendClientOptions {
    region?: string;
    credentials?: AwsCredentials;
    /**
     * Optional pre-built command executor (e.g. an @aws-sdk/client-comprehend
     * ComprehendClient or a test double). Takes precedence over the
     * region/credentials options.
     */
    client?: CommandExecutor;
    /**
     * Maximum size of a single DetectPiiEntities request in UTF-8 bytes.
     * Defaults to 100000, the limit of the synchronous Amazon Comprehend API.
     * Larger documents are split into several requests.
     */
    maxDocumentBytes?: number;
}

export interface PiiDetectionOptions {
    /** Language of the input text. Defaults to "en". */
    language?: LanguageCode;
}

export interface PiiRedactionOptions extends PiiDetectionOptions {
    /**
     * Mask template used to replace detected PII. The "{type}" token is
     * substituted with the entity type, e.g. "[{type}]" becomes "[EMAIL]".
     * Defaults to "[{type}]".
     */
    mask?: string;
    /** When provided, only entities of these types are redacted. */
    entityTypes?: PiiEntityType[];
    /** Minimum confidence score for an entity to be redacted. Defaults to 0. */
    minScore?: number;
}

/**
 * Contract for redaction strategies so that observable chaining is not
 * coupled to AWS Comprehend. Any implementation can be substituted.
 */
export interface PiiRedactor {
    redact(text: string, options?: PiiRedactionOptions): Promise<string>;
    detect(text: string, options?: PiiRedactionOptions): Promise<PiiEntity[]>;
}

import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    DetectPiiEntitiesCommandInput,
    DetectPiiEntitiesCommandOutput,
    PiiEntityType,
} from "@aws-sdk/client-comprehend";

interface ComprehendConstructionOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    sessionToken?: string;
}

interface PIIEntity {
    Type: string;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

interface DetectPIIEntitiesOptions {
    text: string;
    languageCode?: string;
}

interface DetectPIIEntitiesResponse {
    Entities: PIIEntity[];
}

interface RedactPIIOptions {
    text: string;
    languageCode?: string;
    piiEntityTypes?: PiiEntityType[];
    maskMode?: "MASK" | "REPLACE_WITH_PII_ENTITY_TYPE";
}

interface RedactPIIResponse {
    redactedText: string;
    detectedEntities: PIIEntity[];
}

/**
 * AWS Comprehend integration for PII detection and redaction.
 * Uses AWS Comprehend API to detect and redact personally identifiable information (PII)
 * such as names, addresses, phone numbers, SSNs, dates of birth, and email addresses.
 *
 * @example
 * ```typescript
 * const comprehend = new Comprehend({
 *   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
 *   region: "us-east-1"
 * });
 *
 * const result = await comprehend.redactPii({
 *   text: "Hello, my name is John Doe and my phone is 555-123-4567.",
 *   maskMode: "REPLACE_WITH_PII_ENTITY_TYPE"
 * });
 * console.log(result.redactedText);
 * // Output: "Hello, my name is [NAME] and my phone is [PHONE_NUMBER]."
 * ```
 */
export class Comprehend {
    private client: ComprehendClient;
    region: string;

    constructor(options: ComprehendConstructionOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

        const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY || "";
        const secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY || "";
        const sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN || "";

        if (!accessKeyId || !secretAccessKey) {
            console.warn(
                "Warning: AWS credentials are missing. Please provide valid AWS credentials via constructor options or environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)."
            );
        }

        this.client = new ComprehendClient({
            region: this.region,
            credentials: {
                accessKeyId,
                secretAccessKey,
                sessionToken,
            },
        });
    }

    /**
     * Detect PII entities in the given text
     *
     * @param options - Options for PII detection
     * @returns Promise with detected PII entities
     */
    async detectPiiEntities(options: DetectPIIEntitiesOptions): Promise<DetectPIIEntitiesResponse> {
        const input: DetectPiiEntitiesCommandInput = {
            Text: options.text,
            LanguageCode: (options.languageCode || "en") as any,
        };

        try {
            const command = new DetectPiiEntitiesCommand(input);
            const response: DetectPiiEntitiesCommandOutput = await this.client.send(command);

            return {
                Entities: (response.Entities || []).map((entity) => ({
                    Type: entity.Type || "",
                    Score: entity.Score || 0,
                    BeginOffset: entity.BeginOffset || 0,
                    EndOffset: entity.EndOffset || 0,
                })),
            };
        } catch (error: any) {
            console.error("Error detecting PII entities:", error.message || error);
            if (error.$metadata?.httpStatusCode) {
                console.error("HTTP Status:", error.$metadata.httpStatusCode);
            }
            return { Entities: [] };
        }
    }

    /**
     * Redact PII from text by replacing detected entities with their type
     * or a mask
     *
     * @param options - Options for PII redaction
     * @returns Promise with redacted text and detected entities
     */
    async redactPii(options: RedactPIIOptions): Promise<RedactPIIResponse> {
        const detectResponse = await this.detectPiiEntities({
            text: options.text,
            languageCode: options.languageCode || "en",
        });

        let entities = detectResponse.Entities;

        // Filter by entity types if specified
        if (options.piiEntityTypes && options.piiEntityTypes.length > 0) {
            entities = entities.filter((entity) =>
                options.piiEntityTypes!.includes(entity.Type as PiiEntityType)
            );
        }

        // Sort entities by begin offset (descending) to replace from end to beginning
        // This prevents offset shifting when we replace text
        const sortedEntities = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);

        let redactedText = options.text;

        // Replace each PII entity
        for (const entity of sortedEntities) {
            const before = redactedText.substring(0, entity.BeginOffset);
            const after = redactedText.substring(entity.EndOffset);
            const replacement =
                options.maskMode === "REPLACE_WITH_PII_ENTITY_TYPE"
                    ? `[${entity.Type}]`
                    : "*".repeat(entity.EndOffset - entity.BeginOffset);
            redactedText = before + replacement + after;
        }

        return {
            redactedText,
            detectedEntities: entities,
        };
    }

    /**
     * Common PII entity types for easy reference
     * These correspond to AWS Comprehend PII entity types
     */
    static readonly PiiEntityTypes = {
        BANK_ACCOUNT_NUMBER: "BANK_ACCOUNT_NUMBER" as PiiEntityType,
        BANK_ROUTING: "BANK_ROUTING" as PiiEntityType,
        CREDIT_DEBIT_CVV: "CREDIT_DEBIT_CVV" as PiiEntityType,
        CREDIT_DEBIT_EXPIRY: "CREDIT_DEBIT_EXPIRY" as PiiEntityType,
        CREDIT_DEBIT_NUMBER: "CREDIT_DEBIT_NUMBER" as PiiEntityType,
        PIN: "PIN" as PiiEntityType,
        EMAIL: "EMAIL" as PiiEntityType,
        ADDRESS: "ADDRESS" as PiiEntityType,
        NAME: "NAME" as PiiEntityType,
        PHONE: "PHONE" as PiiEntityType,
        SSN: "SSN" as PiiEntityType,
        DATE_TIME: "DATE_TIME" as PiiEntityType,
        PASSPORT_NUMBER: "PASSPORT_NUMBER" as PiiEntityType,
        DRIVER_ID: "DRIVER_ID" as PiiEntityType,
        URL: "URL" as PiiEntityType,
        IP_ADDRESS: "IP_ADDRESS" as PiiEntityType,
        MAC_ADDRESS: "MAC_ADDRESS" as PiiEntityType,
        SSN_LAST_4: "SSN_LAST_4" as PiiEntityType,
        USERNAME: "USERNAME" as PiiEntityType,
        PASSWORD: "PASSWORD" as PiiEntityType,
        AWS_ACCESS_KEY: "AWS_ACCESS_KEY" as PiiEntityType,
        AWS_SECRET_KEY: "AWS_SECRET_KEY" as PiiEntityType,
        LICENSE_PLATE: "LICENSE_PLATE" as PiiEntityType,
        VEHICLE_IDENTIFICATION_NUMBER: "VEHICLE_IDENTIFICATION_NUMBER" as PiiEntityType,
        IBAN_CODE: "IBAN_CODE" as PiiEntityType,
        TAX_ID: "TAX_ID" as PiiEntityType,
        AGE: "AGE" as PiiEntityType,
    } as const;

    /**
     * Get all supported PII entity types
     */
    static getAllPiiEntityTypes(): PiiEntityType[] {
        return Object.values(this.PiiEntityTypes) as PiiEntityType[];
    }

    /**
     * Get common PII entity types that are most frequently used
     */
    static getCommonPiiEntityTypes(): PiiEntityType[] {
        return [
            PiiEntityType.NAME,
            PiiEntityType.EMAIL,
            PiiEntityType.PHONE,
            PiiEntityType.ADDRESS,
            PiiEntityType.SSN,
            PiiEntityType.DATE_TIME,
            PiiEntityType.CREDIT_DEBIT_NUMBER,
            PiiEntityType.PASSPORT_NUMBER,
            PiiEntityType.DRIVER_ID,
        ];
    }
}

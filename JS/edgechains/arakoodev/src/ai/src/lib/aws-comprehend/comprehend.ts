import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    ContainsPiiEntitiesCommand,
    PiiEntityType,
} from "@aws-sdk/client-comprehend";

interface ComprehendConstructorOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

export interface RedactOptions {
    text: string;
    languageCode?: string;
    piiEntityTypes?: PiiEntityType[];
    redactionChar?: string;
}

export interface RedactResult {
    originalText: string;
    redactedText: string;
    entitiesFound: Array<{
        type: string;
        score: number;
        beginOffset: number;
        endOffset: number;
    }>;
}

export interface DetectPiiOptions {
    text: string;
    languageCode?: string;
}

export interface DetectPiiResult {
    containsPii: boolean;
    entities: Array<{
        type: string;
        score: number;
        beginOffset: number;
        endOffset: number;
    }>;
}

/**
 * AWS Comprehend integration for PII detection and redaction
 * Can be chained with existing Endpoint classes to redact sensitive information
 */
export class AWSComprehend {
    private client: ComprehendClient;
    private region: string;

    constructor(options: ComprehendConstructorOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        
        const clientConfig: any = {
            region: this.region,
        };

        // Use provided credentials or fall back to environment variables
        if (options.accessKeyId && options.secretAccessKey) {
            clientConfig.credentials = {
                accessKeyId: options.accessKeyId,
                secretAccessKey: options.secretAccessKey,
            };
        } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            clientConfig.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            };
        }

        this.client = new ComprehendClient(clientConfig);
        this.checkConfiguration();
    }

    private checkConfiguration(): void {
        if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_SECRET_ACCESS_KEY) {
            console.warn(
                "AWS credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables."
            );
        }
    }

    /**
     * Detect PII entities in text
     */
    async detectPii(options: DetectPiiOptions): Promise<DetectPiiResult> {
        const { text, languageCode = "en" } = options;

        try {
            const command = new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: languageCode,
            });

            const response = await this.client.send(command);
            const entities = (response.Entities || []).map((entity) => ({
                type: entity.Type || "UNKNOWN",
                score: entity.Score || 0,
                beginOffset: entity.BeginOffset || 0,
                endOffset: entity.EndOffset || 0,
            }));

            return {
                containsPii: entities.length > 0,
                entities,
            };
        } catch (error) {
            console.error("Error detecting PII:", error);
            throw error;
        }
    }

    /**
     * Redact PII entities from text
     */
    async redact(options: RedactOptions): Promise<RedactResult> {
        const {
            text,
            languageCode = "en",
            piiEntityTypes,
            redactionChar = "*",
        } = options;

        try {
            // First detect PII entities
            const detectResult = await this.detectPii({ text, languageCode });

            if (!detectResult.containsPii) {
                return {
                    originalText: text,
                    redactedText: text,
                    entitiesFound: [],
                };
            }

            // Filter entities if specific types are requested
            let entitiesToRedact = detectResult.entities;
            if (piiEntityTypes && piiEntityTypes.length > 0) {
                entitiesToRedact = detectResult.entities.filter((entity) =>
                    piiEntityTypes.includes(entity.type as PiiEntityType)
                );
            }

            // Sort entities by offset (descending) to redact from end to start
            entitiesToRedact.sort((a, b) => b.beginOffset - a.beginOffset);

            // Redact entities
            let redactedText = text;
            for (const entity of entitiesToRedact) {
                const before = redactedText.substring(0, entity.beginOffset);
                const after = redactedText.substring(entity.endOffset);
                const redaction = redactionChar.repeat(
                    entity.endOffset - entity.beginOffset
                );
                redactedText = before + redaction + after;
            }

            return {
                originalText: text,
                redactedText,
                entitiesFound: detectResult.entities,
            };
        } catch (error) {
            console.error("Error redacting PII:", error);
            throw error;
        }
    }

    /**
     * Check if text contains PII (lightweight check)
     */
    async containsPii(options: DetectPiiOptions): Promise<boolean> {
        const { text, languageCode = "en" } = options;

        try {
            const command = new ContainsPiiEntitiesCommand({
                Text: text,
                LanguageCode: languageCode,
            });

            const response = await this.client.send(command);
            const labels = response.Labels || [];
            
            // Check if any label has high confidence
            return labels.some((label) => (label.Score || 0) > 0.5);
        } catch (error) {
            console.error("Error checking PII:", error);
            throw error;
        }
    }

    /**
     * Chainable method to redact text and pass it to next function
     * This allows integration with existing Endpoint classes
     */
    async chain<T>(
        text: string,
        next: (redactedText: string) => Promise<T>,
        options: Omit<RedactOptions, "text"> = {}
    ): Promise<T> {
        const result = await this.redact({ text, ...options });
        return next(result.redactedText);
    }

    /**
     * Batch redact multiple texts
     */
    async redactBatch(
        texts: string[],
        options: Omit<RedactOptions, "text"> = {}
    ): Promise<RedactResult[]> {
        return Promise.all(
            texts.map((text) => this.redact({ text, ...options }))
        );
    }
}

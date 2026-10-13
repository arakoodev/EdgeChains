import axios from "axios";
import { createHmac } from "crypto";

interface ComprehendPiiRedactorOptions {
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
}

interface RedactOptions {
    text: string;
    entityTypes?: string[]; // e.g., ["NAME", "EMAIL", "PHONE", "SSN", "CREDIT_DEBIT_CARD_NUMBER"]
    maskMode?: "REDACT" | "REPLACE_WITH_ENTITY_TYPE" | "MASK_WITH_CHARACTER";
    maskCharacter?: string;
}

interface RedactResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
}

interface PiiEntity {
    type: string;
    score: number;
    beginOffset: number;
    endOffset: number;
    text: string;
}

// Default PII entity types to detect
const DEFAULT_ENTITY_TYPES = [
    "NAME",
    "EMAIL",
    "PHONE",
    "SSN",
    "CREDIT_DEBIT_CARD_NUMBER",
    "BANK_ACCOUNT_NUMBER",
    "ADDRESS",
    "DATE_OF_BIRTH",
    "DRIVER_ID",
    "PASSPORT_NUMBER",
    "IP_ADDRESS",
];

/**
 * AWS Comprehend PII Redactor
 *
 * Detects and redacts personally identifiable information (PII) from text
 * using AWS Comprehend's DetectPiiEntities API.
 *
 * Can be chained with Endpoint classes (OpenAI, etc.) as an observable
 * to redact sensitive information in prompts before sending to LLMs.
 */
export class ComprehendPiiRedactor {
    private accessKeyId: string;
    private secretAccessKey: string;
    private region: string;

    constructor(options: ComprehendPiiRedactorOptions = {}) {
        this.accessKeyId = options.awsAccessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.awsSecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.region = options.awsRegion || process.env.AWS_REGION || "us-east-1";

        if (!this.accessKeyId || !this.secretAccessKey) {
            console.warn(
                "AWS credentials are missing. Please provide AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY " +
                    "either in options or as environment variables."
            );
        }
    }

    /**
     * Detect PII entities in text using AWS Comprehend
     */
    async detectPiiEntities(text: string, entityTypes?: string[]): Promise<PiiEntity[]> {
        const targetEntityTypes = entityTypes || DEFAULT_ENTITY_TYPES;

        const endpoint = `comprehend.${this.region}.amazonaws.com`;
        const service = "comprehend";
        const action = "DetectPiiEntities";

        const payload = JSON.stringify({
            Text: text,
            LanguageCode: "en",
        });

        const headers: Record<string, string> = {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": `Comprehend_20171127.${action}`,
            Host: endpoint,
        };

        const url = `https://${endpoint}/`;

        try {
            const signedHeaders = this.signRequest(
                "POST",
                url,
                endpoint,
                service,
                headers,
                payload
            );

            const response = await axios.post(url, payload, {
                headers: signedHeaders,
            });

            const entities: PiiEntity[] = (response.data.Entities || [])
                .filter((entity: any) => {
                    // Filter by requested entity types if specified
                    if (targetEntityTypes.length > 0) {
                        return targetEntityTypes.includes(entity.Type);
                    }
                    return entity.Score >= 0.75; // Default confidence threshold
                })
                .map((entity: any) => ({
                    type: entity.Type,
                    score: entity.Score,
                    beginOffset: entity.BeginOffset,
                    endOffset: entity.EndOffset,
                    text: text.substring(entity.BeginOffset, entity.EndOffset),
                }));

            return entities;
        } catch (error: any) {
            if (error.response) {
                console.error("AWS Comprehend API error:", error.response.status, error.response.data);
            } else if (error.request) {
                console.error("No response from AWS Comprehend:", error.message);
            } else {
                console.error("Error calling AWS Comprehend:", error.message);
            }
            throw error;
        }
    }

    /**
     * Redact PII from text
     */
    async redact(options: RedactOptions): Promise<RedactResult> {
        const { text, entityTypes, maskMode = "REPLACE_WITH_ENTITY_TYPE", maskCharacter = "*" } = options;

        const entities = await this.detectPiiEntities(text, entityTypes);

        // Sort entities by offset in descending order to replace from end to start
        // (preserves offsets during replacement)
        const sortedEntities = [...entities].sort((a, b) => b.beginOffset - a.beginOffset);

        let redactedText = text;

        for (const entity of sortedEntities) {
            let replacement: string;

            switch (maskMode) {
                case "REDACT":
                    replacement = "[REDACTED]";
                    break;
                case "MASK_WITH_CHARACTER":
                    replacement = maskCharacter.repeat(entity.endOffset - entity.beginOffset);
                    break;
                case "REPLACE_WITH_ENTITY_TYPE":
                default:
                    replacement = `[${entity.type}]`;
                    break;
            }

            redactedText =
                redactedText.substring(0, entity.beginOffset) +
                replacement +
                redactedText.substring(entity.endOffset);
        }

        return {
            originalText: text,
            redactedText,
            entities,
        };
    }

    /**
     * Chainable method: Create a pre-processing function that redacts PII
     * from text before passing it to an LLM endpoint.
     *
     * Usage:
     *   const redactor = new ComprehendPiiRedactor();
     *   const redactPrompt = redactor.createPromptRedactor();
     *   const safePrompt = await redactPrompt("My name is John, email is john@example.com");
     */
    createPromptRedactor(
        entityTypes?: string[],
        maskMode: "REDACT" | "REPLACE_WITH_ENTITY_TYPE" | "MASK_WITH_CHARACTER" = "REPLACE_WITH_ENTITY_TYPE"
    ): (text: string) => Promise<string> {
        return async (text: string): Promise<string> => {
            const result = await this.redact({ text, entityTypes, maskMode });
            return result.redactedText;
        };
    }

    /**
     * Chainable method: Wrap an async function to redact PII from its string input.
     * Works as an observable/middleware for Endpoint classes.
     *
     * Usage:
     *   const redactor = new ComprehendPiiRedactor();
     *   const safeChat = redactor.chainWith(openai.chat.bind(openai));
     *   const response = await safeChat({ prompt: "Hi, I'm John Smith..." });
     */
    chainWith<T extends { prompt?: string; messages?: Array<{ content: string }> }>(
        endpointFn: (options: T) => Promise<any>
    ): (options: T) => Promise<any> {
        return async (options: T): Promise<any> => {
            const redactedOptions = { ...options };

            // Redact prompt if present
            if (options.prompt) {
                const result = await this.redact({ text: options.prompt });
                redactedOptions.prompt = result.redactedText;
            }

            // Redact messages if present
            if (options.messages) {
                const redactedMessages = await Promise.all(
                    options.messages.map(async (msg) => ({
                        ...msg,
                        content: (await this.redact({ text: msg.content })).redactedText,
                    }))
                );
                redactedOptions.messages = redactedMessages;
            }

            return endpointFn(redactedOptions);
        };
    }

    /**
     * AWS Signature Version 4 signing for Comprehend API requests
     */
    private signRequest(
        method: string,
        url: string,
        endpoint: string,
        service: string,
        headers: Record<string, string>,
        payload: string
    ): Record<string, string> {
        const now = new Date();
        const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "").substring(0, 8);
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");

        // Add required headers
        const signedHeaders = { ...headers };
        signedHeaders["X-Amz-Date"] = amzDate;

        // Create canonical request
        const canonicalHeaders = Object.keys(signedHeaders)
            .sort()
            .map((key) => `${key.toLowerCase()}:${signedHeaders[key].trim()}\n`)
            .join("");

        const signedHeaderKeys = Object.keys(signedHeaders).sort().join(";").toLowerCase();

        const payloadHash = this.sha256(payload);
        signedHeaders["X-Amz-Content-Sha256"] = payloadHash;

        const canonicalRequest = [
            method,
            "/",
            "",
            canonicalHeaders,
            signedHeaderKeys,
            payloadHash,
        ].join("\n");

        // Create string to sign
        const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
        const stringToSign = [
            "AWS4-HMAC-SHA256",
            amzDate,
            credentialScope,
            this.sha256(canonicalRequest),
        ].join("\n");

        // Calculate signature
        const signingKey = this.getSignatureKey(this.secretAccessKey, dateStamp, this.region, service);
        const signature = this.hmacSha256Hex(signingKey, stringToSign);

        // Add Authorization header
        signedHeaders["Authorization"] = [
            `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}`,
            `SignedHeaders=${signedHeaderKeys}`,
            `Signature=${signature}`,
        ].join(", ");

        return signedHeaders;
    }

    private sha256(data: string): string {
        return createHmac("sha256", "").update(data).digest("hex");
    }

    private hmacSha256(key: Buffer, data: string): Buffer {
        return createHmac("sha256", key).update(data).digest();
    }

    private hmacSha256Hex(key: Buffer, data: string): string {
        return createHmac("sha256", key).update(data).digest("hex");
    }

    private getSignatureKey(
        key: string,
        dateStamp: string,
        regionName: string,
        serviceName: string
    ): Buffer {
        const kDate = this.hmacSha256(Buffer.from(`AWS4${key}`), dateStamp);
        const kRegion = this.hmacSha256(kDate, regionName);
        const kService = this.hmacSha256(kRegion, serviceName);
        const kSigning = this.hmacSha256(kService, "aws4_request");
        return kSigning;
    }
}

export type { ComprehendPiiRedactorOptions, RedactOptions, RedactResult, PiiEntity };

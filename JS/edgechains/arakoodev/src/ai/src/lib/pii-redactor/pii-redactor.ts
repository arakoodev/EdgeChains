import axios from "axios";

/**
 * Configuration options for the PIIRedactor class
 */
interface PIIRedactorOptions {
    /** AWS Region for Comprehend service */
    region?: string;
    /** AWS Access Key ID */
    accessKeyId?: string;
    /** AWS Secret Access Key */
    secretAccessKey?: string;
    /** PII entity types to detect and redact. Defaults to all types */
    piiTypes?: string[];
    /** Character to use for redaction. Defaults to "***" */
    redactionChar?: string;
}

/**
 * Detected PII entity
 */
interface PIIEntity {
    /** Type of PII detected (e.g., NAME, EMAIL, PHONE, SSN) */
    Type: string;
    /** Start offset of the PII in the text */
    BeginOffset: number;
    /** End offset of the PII in the text */
    EndOffset: number;
    /** Confidence score (0-1) */
    Score: number;
}

/**
 * Result of PII redaction
 */
interface PIIRedactionResult {
    /** The redacted text */
    redactedText: string;
    /** List of detected PII entities */
    detectedEntities: PIIEntity[];
    /** Number of PII entities found */
    count: number;
}

/**
 * PIIRedactor - A utility class that integrates with AWS Comprehend
 * to detect and redact Personally Identifiable Information (PII) from text.
 * 
 * Can be chained with existing AI Endpoint classes as an observable
 * to automatically redact PII in prompts before sending to LLMs.
 * 
 * @example
 * ```typescript
 * const redactor = new PIIRedactor({
 *     region: "us-east-1",
 *     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
 *     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
 * });
 * 
 * // Redact PII from text
 * const result = await redactor.redact("My SSN is 123-45-6789 and email is john@example.com");
 * console.log(result.redactedText); // "My SSN is *** and email is ***"
 * 
 * // Chain with OpenAI endpoint
 * const prompt = "Contact John at john@example.com or 555-1234";
 * const redacted = await redactor.redact(prompt);
 * const response = await openai.chat({ prompt: redacted.redactedText });
 * ```
 */
export class PIIRedactor {
    private region: string;
    private accessKeyId: string;
    private secretAccessKey: string;
    private piiTypes: string[];
    private redactionChar: string;
    private comprehendEndpoint: string;

    constructor(options: PIIRedactorOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.piiTypes = options.piiTypes || [];
        this.redactionChar = options.redactionChar || "***";
        this.comprehendEndpoint = `https://comprehend.${this.region}.amazonaws.com`;
        
        this.checkKeys();
    }

    /**
     * Validate AWS credentials are present
     */
    private checkKeys(): void {
        if (!this.accessKeyId) {
            console.error(
                "AWS Access Key ID is missing. Provide it in constructor or set AWS_ACCESS_KEY_ID env variable."
            );
        }
        if (!this.secretAccessKey) {
            console.error(
                "AWS Secret Access Key is missing. Provide it in constructor or set AWS_SECRET_ACCESS_KEY env variable."
            );
        }
    }

    /**
     * Get AWS Signature V4 headers for Comprehend API request
     */
    private async getAuthHeaders(payload: string): Promise<Record<string, string>> {
        const crypto = await import("crypto");
        const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const service = "comprehend";
        
        const canonicalUri = "/";
        const canonicalQuerystring = "";
        const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");
        
        const canonicalHeaders = [
            `content-type:application/x-amz-json-1.1`,
            `host:comprehend.${this.region}.amazonaws.com`,
            `x-amz-date:${amzDate}`,
        ].join("\n") + "\n";
        
        const signedHeaders = "content-type;host;x-amz-date";
        
        const canonicalRequest = [
            "POST",
            canonicalUri,
            canonicalQuerystring,
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join("\n");
        
        const algorithm = "AWS4-HMAC-SHA256";
        const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
        const stringToSign = [
            algorithm,
            amzDate,
            credentialScope,
            crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
        ].join("\n");
        
        const sign = (key: Buffer, msg: string) =>
            crypto.createHmac("sha256", key).update(msg).digest();
        
        const kDate = sign(Buffer.from(`AWS4${this.secretAccessKey}`), dateStamp);
        const kRegion = sign(kDate, this.region);
        const kService = sign(kRegion, service);
        const kSigning = sign(kService, "aws4_request");
        
        const signature = crypto
            .createHmac("sha256", kSigning)
            .update(stringToSign)
            .digest("hex");
        
        const authorizationHeader = [
            `${algorithm} Credential=${this.accessKeyId}/${credentialScope}`,
            `SignedHeaders=${signedHeaders}`,
            `Signature=${signature}`,
        ].join(", ");
        
        return {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "Comprehend_20171127.DetectPiiEntities",
            "X-Amz-Date": amzDate,
            Authorization: authorizationHeader,
        };
    }

    /**
     * Detect PII entities in text using AWS Comprehend
     */
    async detectPII(text: string): Promise<PIIEntity[]> {
        if (!text || text.trim().length === 0) {
            return [];
        }

        const payload = JSON.stringify({
            Text: text,
            LanguageCode: "en",
        });

        try {
            const headers = await this.getAuthHeaders(payload);
            
            const response = await axios.post(
                this.comprehendEndpoint,
                payload,
                { headers }
            );

            const entities: PIIEntity[] = response.data.Entities || [];
            
            // Filter by requested PII types if specified
            if (this.piiTypes.length > 0) {
                return entities.filter((e: PIIEntity) =>
                    this.piiTypes.includes(e.Type)
                );
            }
            
            return entities;
        } catch (error: any) {
            if (error.response) {
                console.error("Comprehend API error:", error.response.status, error.response.data);
            } else {
                console.error("PII detection error:", error.message);
            }
            return [];
        }
    }

    /**
     * Redact PII entities from text, replacing them with the redaction character
     */
    async redact(text: string): Promise<PIIRedactionResult> {
        if (!text || text.trim().length === 0) {
            return {
                redactedText: text || "",
                detectedEntities: [],
                count: 0,
            };
        }

        const entities = await this.detectPII(text);
        
        if (entities.length === 0) {
            return {
                redactedText: text,
                detectedEntities: [],
                count: 0,
            };
        }

        // Sort entities by position (reverse order for safe replacement)
        const sortedEntities = [...entities].sort(
            (a, b) => b.BeginOffset - a.BeginOffset
        );

        let redactedText = text;
        for (const entity of sortedEntities) {
            const before = redactedText.substring(0, entity.BeginOffset);
            const after = redactedText.substring(entity.EndOffset);
            redactedText = before + this.redactionChar + after;
        }

        return {
            redactedText,
            detectedEntities: entities,
            count: entities.length,
        };
    }

    /**
     * Chain method: redact PII from a prompt string and return the cleaned prompt.
     * Useful for chaining with Endpoint classes.
     */
    async redactPrompt(prompt: string): Promise<string> {
        const result = await this.redact(prompt);
        return result.redactedText;
    }

    /**
     * Chain method: redact PII from an array of message objects.
     * Useful for redacting chat message histories.
     */
    async redactMessages(
        messages: Array<{ role: string; content: string }>
    ): Promise<Array<{ role: string; content: string }>> {
        const redactedMessages = [];
        for (const msg of messages) {
            const result = await this.redact(msg.content);
            redactedMessages.push({
                role: msg.role,
                content: result.redactedText,
            });
        }
        return redactedMessages;
    }

    /**
     * Get unique PII types found in the text
     */
    async getDetectedTypes(text: string): Promise<string[]> {
        const entities = await this.detectPII(text);
        const types = new Set(entities.map((e) => e.Type));
        return Array.from(types);
    }
}

// CLA: I have read the Arakoo CLA Document and I hereby sign the CLA

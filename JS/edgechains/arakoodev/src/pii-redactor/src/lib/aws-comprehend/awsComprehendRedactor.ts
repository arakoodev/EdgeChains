import axios from "axios";
import { createHmac, createHash } from "crypto";

export interface PIIEntity {
    Type: string;
    BeginOffset: number;
    EndOffset: number;
    Score: number;
}

interface DetectPiiResult {
    Entities: PIIEntity[];
}

export interface RedactionResult {
    redactedText: string;
    entities: PIIEntity[];
}

interface AWSComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    languageCode?: string;
}

/**
 * AWSComprehendRedactor — detects and redacts PII using AWS Comprehend.
 *
 * Wraps the AWS Comprehend DetectPiiEntities API directly (no AWS SDK dependency).
 * Implements AWS Signature Version 4 for authentication.
 */
export class AWSComprehendRedactor {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    languageCode: string;
    private service: string = "comprehend";

    constructor(options: AWSComprehendOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.languageCode = options.languageCode || "en";
    }

    private sign(key: Buffer, msg: string): Buffer {
        return createHmac("sha256", key).update(msg).digest();
    }

    private getSignatureKey(dateStamp: string): Buffer {
        const kDate = this.sign(Buffer.from("AWS4" + this.secretAccessKey), dateStamp);
        const kRegion = this.sign(kDate, this.region);
        const kService = this.sign(kRegion, this.service);
        return this.sign(kService, "aws4_request");
    }

    private async callComprehend(action: string, body: object): Promise<any> {
        const host = `comprehend.${this.region}.amazonaws.com`;
        const endpoint = `https://${host}/`;
        const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const payload = JSON.stringify(body);

        // Canonical request
        const canonicalUri = "/";
        const canonicalQuerystring = "";
        const canonicalHeaders =
            `content-type:application/x-amz-json-1.1\n` +
            `host:${host}\n` +
            `x-amz-date:${amzDate}\n` +
            `x-amz-target:com.amazonaws.comprehend.${action}\n`;
        const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
        const payloadHash = createHash("sha256").update(payload).digest("hex");
        const canonicalRequest =
            `POST\n${canonicalUri}\n${canonicalQuerystring}\n` +
            `${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

        // String to sign
        const algorithm = "AWS4-HMAC-SHA256";
        const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`;
        const hashedCanonicalRequest = createHash("sha256").update(canonicalRequest).digest("hex");
        const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${hashedCanonicalRequest}`;

        // Signature
        const signingKey = this.getSignatureKey(dateStamp);
        const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
        const authorizationHeader =
            `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const response = await axios.post(endpoint, payload, {
            headers: {
                "Content-Type": "application/x-amz-json-1.1",
                "X-Amz-Date": amzDate,
                "X-Amz-Target": `com.amazonaws.comprehend.${action}`,
                Authorization: authorizationHeader,
            },
        });
        return response.data;
    }

    /**
     * Detect PII entities in text using AWS Comprehend.
     */
    async detectPii(text: string): Promise<PIIEntity[]> {
        const result: DetectPiiResult = await this.callComprehend("DetectPiiEntities", {
            Text: text,
            LanguageCode: this.languageCode,
        });
        return result.Entities || [];
    }

    /**
     * Redact detected PII entities from text, replacing with [REDACTED:TYPE].
     */
    async redact(text: string): Promise<RedactionResult> {
        const entities = await this.detectPii(text);
        // Sort by BeginOffset descending so replacements don't shift offsets
        const sorted = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
        let redactedText = text;
        for (const entity of sorted) {
            const placeholder = `[REDACTED:${entity.Type}]`;
            redactedText =
                redactedText.slice(0, entity.BeginOffset) +
                placeholder +
                redactedText.slice(entity.EndOffset);
        }
        return { redactedText, entities };
    }

    /**
     * Check if text contains PII.
     */
    async containsPii(text: string): Promise<boolean> {
        const entities = await this.detectPii(text);
        return entities.length > 0;
    }
}

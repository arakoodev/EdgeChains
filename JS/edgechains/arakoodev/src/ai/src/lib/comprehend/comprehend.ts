import axios from "axios";
import crypto from "crypto";
import { retry } from "@lifeomic/attempt";

export interface ComprehendConstructionOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
}

export interface PiiEntity {
    BeginOffset: number;
    EndOffset: number;
    Score: number;
    Type: string;
}

export interface RedactPiiOptions {
    text: string;
    languageCode?: string;
    maskCharacter?: string;
    maskMode?: "MASK" | "REPLACE_WITH_PII_ENTITY_TYPE";
    piiEntityTypes?: string[];
    confidenceThreshold?: number;
    max_retry?: number;
    delay?: number;
}

export interface RedactPiiResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
}

/**
 * AWS Comprehend PII Detection & Redaction Utility for EdgeChains JS (`arakoodev/EdgeChains#290`).
 * Uses native AWS Signature Version 4 signing with `axios` so no heavy SDK bloat is required.
 */
export class ComprehendAI {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;

    constructor(options: ComprehendConstructionOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
    }

    private hmac(key: string | Buffer, data: string): Buffer {
        return crypto.createHmac("sha256", key).update(data, "utf8").digest();
    }

    private sha256(data: string): string {
        return crypto.createHash("sha256").update(data, "utf8").digest("hex");
    }

    private signRequest(target: string, body: string): Record<string, string> {
        const host = `comprehend.${this.region}.amazonaws.com`;
        const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const contentType = "application/x-amz-json-1.1";
        const payloadHash = this.sha256(body);

        const canonicalHeaders =
            `content-type:${contentType}\n` +
            `host:${host}\n` +
            `x-amz-date:${amzDate}\n` +
            `x-amz-target:${target}\n`;
        const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
        const canonicalRequest = [
            "POST",
            "/",
            "",
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join("\n");

        const algorithm = "AWS4-HMAC-SHA256";
        const credentialScope = `${dateStamp}/${this.region}/comprehend/aws4_request`;
        const stringToSign = [
            algorithm,
            amzDate,
            credentialScope,
            this.sha256(canonicalRequest),
        ].join("\n");

        const kDate = this.hmac(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = this.hmac(kDate, this.region);
        const kService = this.hmac(kRegion, "comprehend");
        const kSigning = this.hmac(kService, "aws4_request");
        const signature = crypto
            .createHmac("sha256", kSigning)
            .update(stringToSign, "utf8")
            .digest("hex");

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": target,
            Authorization: `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        };

        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }
        return headers;
    }

    /**
     * Call AWS Comprehend `DetectPiiEntities` to locate PII spans in text.
     */
    async detectPiiEntities(
        text: string,
        languageCode = "en",
        max_retry = 3,
        delay = 200
    ): Promise<PiiEntity[]> {
        const url = `https://comprehend.${this.region}.amazonaws.com/`;
        const body = JSON.stringify({
            Text: text,
            LanguageCode: languageCode,
        });

        return await retry(
            async () => {
                const headers = this.signRequest("Comprehend_20171127.DetectPiiEntities", body);
                const res = await axios.post(url, body, { headers });
                return (res.data?.Entities || []) as PiiEntity[];
            },
            { maxAttempts: max_retry, delay }
        );
    }

    /**
     * Detect and redact PII entities from input text using AWS Comprehend (`DetectPiiEntities`).
     */
    async redactPii(options: RedactPiiOptions): Promise<RedactPiiResult> {
        const {
            text,
            languageCode = "en",
            maskCharacter = "*",
            maskMode = "REPLACE_WITH_PII_ENTITY_TYPE",
            piiEntityTypes,
            confidenceThreshold = 0.5,
            max_retry = 3,
            delay = 200,
        } = options;

        const entities = await this.detectPiiEntities(text, languageCode, max_retry, delay);
        const filtered = entities
            .filter((e) => e.Score >= confidenceThreshold)
            .filter((e) => !piiEntityTypes || piiEntityTypes.includes(e.Type))
            .sort((a, b) => b.BeginOffset - a.BeginOffset);

        let redactedText = text;
        for (const entity of filtered) {
            const length = Math.max(1, entity.EndOffset - entity.BeginOffset);
            const replacement =
                maskMode === "REPLACE_WITH_PII_ENTITY_TYPE"
                    ? `[${entity.Type}]`
                    : maskCharacter.repeat(length);
            redactedText =
                redactedText.slice(0, entity.BeginOffset) +
                replacement +
                redactedText.slice(entity.EndOffset);
        }

        return {
            originalText: text,
            redactedText,
            entities: filtered.reverse(),
        };
    }
}

import crypto from "node:crypto";

export interface AwsComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    minConfidence?: number;
    maskCharacter?: string;
    maskMode?: "MASK" | "REPLACE_WITH_PII_ENTITY_TYPE";
    endpoint?: string;
}

export interface PiiEntity {
    Type: string;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface RedactPiiResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
}

function sha256Hex(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

export class AwsComprehendClient {
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
    readonly languageCode: string;
    readonly minConfidence: number;
    readonly maskCharacter: string;
    readonly maskMode: "MASK" | "REPLACE_WITH_PII_ENTITY_TYPE";
    readonly endpoint: string;

    constructor(options: AwsComprehendOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.languageCode = options.languageCode || "en";
        this.minConfidence = options.minConfidence ?? 0.5;
        this.maskCharacter = options.maskCharacter || "*";
        this.maskMode = options.maskMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        const defaultHost = `https://comprehend.${this.region}.amazonaws.com/`;
        this.endpoint = options.endpoint || defaultHost;
    }

    buildSigV4Headers(targetAction: string, payload: string, now = new Date()) {
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const urlObj = new URL(this.endpoint);
        const host = urlObj.host;
        const contentType = "application/x-amz-json-1.1";
        const payloadHash = sha256Hex(payload);

        const canonicalHeaders =
            `content-type:${contentType}\n` +
            `host:${host}\n` +
            `x-amz-date:${amzDate}\n` +
            `x-amz-target:${targetAction}\n`;
        const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
        const canonicalRequest = [
            "POST",
            urlObj.pathname || "/",
            "",
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join("\n");

        const credentialScope = `${dateStamp}/${this.region}/comprehend/aws4_request`;
        const stringToSign = [
            "AWS4-HMAC-SHA256",
            amzDate,
            credentialScope,
            sha256Hex(canonicalRequest),
        ].join("\n");

        const kDate = hmacSha256(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = hmacSha256(kDate, this.region);
        const kService = hmacSha256(kRegion, "comprehend");
        const kSigning = hmacSha256(kService, "aws4_request");
        const signature = hmacSha256(kSigning, stringToSign).toString("hex");

        const authHeader =
            `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            Host: host,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": targetAction,
            Authorization: authHeader,
        };
        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }
        return headers;
    }

    async detectPiiEntities(text: string, languageCode = this.languageCode): Promise<PiiEntity[]> {
        if (!text || typeof text !== "string") {
            return [];
        }
        if (!this.accessKeyId || !this.secretAccessKey) {
            return this.detectLocalFallbackPii(text);
        }
        const body = JSON.stringify({
            Text: text,
            LanguageCode: languageCode,
        });
        const target = "Comprehend_20171127.DetectPiiEntities";
        const headers = this.buildSigV4Headers(target, body);
        const response = await fetch(this.endpoint, {
            method: "POST",
            headers,
            body,
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`AWS Comprehend error (${response.status}): ${errText}`);
        }
        const data = (await response.json()) as { Entities?: PiiEntity[] };
        return Array.isArray(data.Entities) ? data.Entities : [];
    }

    detectLocalFallbackPii(text: string): PiiEntity[] {
        const patterns: Array<{ type: string; regex: RegExp }> = [
            {
                type: "EMAIL",
                regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            },
            {
                type: "SSN",
                regex: /\b\d{3}-\d{2}-\d{4}\b/g,
            },
            {
                type: "PHONE",
                regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
            },
            {
                type: "AWS_ACCESS_KEY",
                regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
            },
            {
                type: "IP_ADDRESS",
                regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
            },
        ];

        const detected: PiiEntity[] = [];
        for (const item of patterns) {
            let match: RegExpExecArray | null;
            while ((match = item.regex.exec(text)) !== null) {
                detected.push({
                    Type: item.type,
                    Score: 0.99,
                    BeginOffset: match.index,
                    EndOffset: match.index + match[0].length,
                });
            }
        }
        return detected.sort((a, b) => a.BeginOffset - b.BeginOffset);
    }

    applyRedaction(text: string, entities: PiiEntity[], types?: string[]): RedactPiiResult {
        const typeSet = types ? new Set(types.map((t) => t.toUpperCase())) : null;
        const filtered = entities
            .filter((e) => e.Score >= this.minConfidence)
            .filter((e) => (!typeSet ? true : typeSet.has(e.Type.toUpperCase())))
            .sort((a, b) => a.BeginOffset - b.BeginOffset);

        let cursor = 0;
        let out = "";
        for (const entity of filtered) {
            if (entity.BeginOffset < cursor) {
                continue;
            }
            out += text.slice(cursor, entity.BeginOffset);
            if (this.maskMode === "MASK") {
                const spanLen = Math.max(1, entity.EndOffset - entity.BeginOffset);
                out += this.maskCharacter.repeat(spanLen);
            } else {
                out += `[${entity.Type}]`;
            }
            cursor = entity.EndOffset;
        }
        out += text.slice(cursor);

        return {
            originalText: text,
            redactedText: out,
            entities: filtered,
        };
    }

    async redactPii(text: string, allowedTypes?: string[]): Promise<RedactPiiResult> {
        const entities = await this.detectPiiEntities(text);
        return this.applyRedaction(text, entities, allowedTypes);
    }
}

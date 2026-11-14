import crypto from "crypto";

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
    | "IP_ADDRESS"
    | "MAC_ADDRESS"
    | "USERNAME"
    | "PASSWORD"
    | "AWS_ACCESS_KEY"
    | "AWS_SECRET_KEY"
    | "ALL"
    | string;

export interface PiiEntity {
    Score: number;
    Type: PiiEntityType;
    BeginOffset: number;
    EndOffset: number;
}

export interface ComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    endpoint?: string;
    languageCode?: string;
    minConfidence?: number;
    maxRetry?: number;
    delay?: number;
    fetchFn?: typeof fetch;
}

export interface RedactOptions {
    languageCode?: string;
    minConfidence?: number;
    piiEntityTypes?: PiiEntityType[];
    maskMode?: "TAG" | "MASK" | "CUSTOM";
    maskCharacter?: string;
    customReplacement?: string;
    useLocalFallback?: boolean;
}

export interface RedactResult {
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

export class ComprehendRedactor {
    private region: string;
    private accessKeyId: string;
    private secretAccessKey: string;
    private sessionToken?: string;
    private endpoint: string;
    private languageCode: string;
    private minConfidence: number;
    private maxRetry: number;
    private delay: number;
    private fetchFn: typeof fetch;

    constructor(options: ComprehendOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.endpoint =
            options.endpoint || `https://comprehend.${this.region}.amazonaws.com/`;
        this.languageCode = options.languageCode || "en";
        this.minConfidence = options.minConfidence ?? 0.5;
        this.maxRetry = options.maxRetry ?? 3;
        this.delay = options.delay ?? 200;
        this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
    }

    /**
     * Generates AWS Signature Version 4 headers for AWS Comprehend JSON 1.1 requests.
     */
    public signRequest(
        payload: string,
        amzTarget: string = "Comprehend_20171127.DetectPiiEntities",
        now: Date = new Date()
    ): Record<string, string> {
        const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = iso.slice(0, 8);
        const urlObj = new URL(this.endpoint);
        const host = urlObj.host;
        const service = "comprehend";

        const contentType = "application/x-amz-json-1.1";
        const payloadHash = sha256Hex(payload);

        const canonicalHeadersMap: Record<string, string> = {
            "content-type": contentType,
            host,
            "x-amz-date": iso,
            "x-amz-target": amzTarget,
        };
        if (this.sessionToken) {
            canonicalHeadersMap["x-amz-security-token"] = this.sessionToken;
        }

        const sortedHeaderKeys = Object.keys(canonicalHeadersMap).sort();
        const canonicalHeaders = sortedHeaderKeys
            .map((k) => `${k}:${canonicalHeadersMap[k]}\n`)
            .join("");
        const signedHeaders = sortedHeaderKeys.join(";");

        const canonicalRequest = [
            "POST",
            urlObj.pathname || "/",
            "",
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join("\n");

        const algorithm = "AWS4-HMAC-SHA256";
        const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
        const stringToSign = [
            algorithm,
            iso,
            credentialScope,
            sha256Hex(canonicalRequest),
        ].join("\n");

        const kDate = hmacSha256(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = hmacSha256(kDate, this.region);
        const kService = hmacSha256(kRegion, service);
        const kSigning = hmacSha256(kService, "aws4_request");
        const signature = crypto
            .createHmac("sha256", kSigning)
            .update(stringToSign, "utf8")
            .digest("hex");

        const authorizationHeader = `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "X-Amz-Date": iso,
            "X-Amz-Target": amzTarget,
            Authorization: authorizationHeader,
        };

        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }

        return headers;
    }

    /**
     * Calls AWS Comprehend DetectPiiEntities API to identify PII entities in text.
     */
    public async detectPiiEntities(
        text: string,
        languageCode: string = this.languageCode
    ): Promise<PiiEntity[]> {
        if (!text) return [];

        const payload = JSON.stringify({
            Text: text,
            LanguageCode: languageCode,
        });

        let lastError: unknown;
        for (let attempt = 1; attempt <= this.maxRetry; attempt++) {
            try {
                const headers = this.signRequest(payload, "Comprehend_20171127.DetectPiiEntities");
                const response = await this.fetchFn(this.endpoint, {
                    method: "POST",
                    headers,
                    body: payload,
                });
                if (!response.ok) {
                    throw new Error(`AWS Comprehend HTTP ${response.status}: ${response.statusText}`);
                }
                const data = (await response.json()) as { Entities?: PiiEntity[] };
                return Array.isArray(data?.Entities) ? data.Entities : [];
            } catch (err) {
                lastError = err;
                if (attempt < this.maxRetry && this.delay > 0) {
                    await new Promise((r) => setTimeout(r, this.delay));
                }
            }
        }
        throw lastError;
    }

    /**
     * Local fallback PII detector when offline or when `useLocalFallback` is enabled.
     */
    public detectPiiEntitiesLocal(text: string): PiiEntity[] {
        const patterns: Array<{ type: PiiEntityType; regex: RegExp }> = [
            {
                type: "EMAIL",
                regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
            },
            {
                type: "SSN",
                regex: /\b\d{3}-\d{2}-\d{4}\b/g,
            },
            {
                type: "CREDIT_DEBIT_NUMBER",
                regex: /\b(?:\d[ -]*?){13,16}\b/g,
            },
            {
                type: "PHONE",
                regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
            },
            {
                type: "IP_ADDRESS",
                regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
            },
            {
                type: "AWS_ACCESS_KEY",
                regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
            },
        ];

        const entities: PiiEntity[] = [];
        for (const { type, regex } of patterns) {
            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                entities.push({
                    Score: 0.99,
                    Type: type,
                    BeginOffset: match.index,
                    EndOffset: match.index + match[0].length,
                });
            }
        }

        return entities.sort((a, b) => a.BeginOffset - b.BeginOffset);
    }

    /**
     * Redacts PII entities from the input text using AWS Comprehend (or local fallback if configured).
     */
    public async redact(text: string, options: RedactOptions = {}): Promise<RedactResult> {
        if (!text) {
            return { originalText: text, redactedText: text, entities: [] };
        }

        const minConfidence = options.minConfidence ?? this.minConfidence;
        const maskMode = options.maskMode ?? "TAG";
        const maskCharacter = options.maskCharacter ?? "*";
        const allowedTypes =
            options.piiEntityTypes && !options.piiEntityTypes.includes("ALL")
                ? new Set(options.piiEntityTypes)
                : null;

        let rawEntities: PiiEntity[];
        if (options.useLocalFallback && (!this.accessKeyId || !this.secretAccessKey)) {
            rawEntities = this.detectPiiEntitiesLocal(text);
        } else {
            try {
                rawEntities = await this.detectPiiEntities(
                    text,
                    options.languageCode || this.languageCode
                );
            } catch (err) {
                if (options.useLocalFallback) {
                    rawEntities = this.detectPiiEntitiesLocal(text);
                } else {
                    throw err;
                }
            }
        }

        const filteredEntities = rawEntities
            .filter((entity) => {
                if (entity.Score < minConfidence) return false;
                if (allowedTypes && !allowedTypes.has(entity.Type)) return false;
                return (
                    entity.BeginOffset >= 0 &&
                    entity.EndOffset > entity.BeginOffset &&
                    entity.EndOffset <= text.length
                );
            })
            .sort((a, b) => a.BeginOffset - b.BeginOffset);

        let redactedText = "";
        let cursor = 0;

        for (const entity of filteredEntities) {
            if (entity.BeginOffset < cursor) {
                continue;
            }
            redactedText += text.slice(cursor, entity.BeginOffset);

            const spanLength = entity.EndOffset - entity.BeginOffset;
            if (maskMode === "MASK") {
                redactedText += maskCharacter.repeat(spanLength);
            } else if (maskMode === "CUSTOM") {
                redactedText += options.customReplacement ?? "[REDACTED]";
            } else {
                redactedText += `[${entity.Type}]`;
            }

            cursor = entity.EndOffset;
        }

        redactedText += text.slice(cursor);

        return {
            originalText: text,
            redactedText,
            entities: filteredEntities,
        };
    }

    /**
     * Convenience method returning only the redacted string.
     */
    public async redactText(text: string, options: RedactOptions = {}): Promise<string> {
        const result = await this.redact(text, options);
        return result.redactedText;
    }
}

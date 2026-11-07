import axios from "axios";
import * as crypto from "crypto";

export interface PiiEntity {
    Type: string;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface AwsComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    minConfidenceScore?: number;
    maskMode?: "TYPE_TAG" | "ASTERISK";
    entityTypes?: string[];
    fallbackLocalRules?: boolean;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
}

export class PromptObservable<T> {
    constructor(private readonly producer: () => Promise<T>) {}

    pipe<R>(operator: (value: T) => Promise<R> | R): PromptObservable<R> {
        return new PromptObservable<R>(async () => {
            const val = await this.producer();
            return await operator(val);
        });
    }

    async subscribe(observer?: (value: T) => void): Promise<T> {
        const result = await this.producer();
        if (observer) {
            observer(result);
        }
        return result;
    }
}

export class AwsComprehendRedactor {
    private region: string;
    private accessKeyId: string;
    private secretAccessKey: string;
    private sessionToken?: string;
    private languageCode: string;
    private minConfidenceScore: number;
    private maskMode: "TYPE_TAG" | "ASTERISK";
    private entityTypes?: string[];
    private fallbackLocalRules: boolean;

    constructor(options: AwsComprehendOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.languageCode = options.languageCode || "en";
        this.minConfidenceScore = options.minConfidenceScore ?? 0.5;
        this.maskMode = options.maskMode || "TYPE_TAG";
        this.entityTypes = options.entityTypes;
        this.fallbackLocalRules = options.fallbackLocalRules ?? true;
    }

    async detectPiiEntities(text: string): Promise<PiiEntity[]> {
        if (!text) return [];

        if (this.accessKeyId && this.secretAccessKey) {
            try {
                const host = `comprehend.${this.region}.amazonaws.com`;
                const endpoint = `https://${host}/`;
                const payload = JSON.stringify({
                    Text: text,
                    LanguageCode: this.languageCode,
                });
                const headers = this.signAwsRequest(host, payload, "Comprehend_20171127.DetectPiiEntities");
                const response = await axios.post(endpoint, payload, { headers });
                const entities: PiiEntity[] = response.data?.Entities || [];
                return this.filterEntities(entities);
            } catch (error) {
                if (!this.fallbackLocalRules) {
                    throw error;
                }
            }
        }

        return this.filterEntities(this.detectLocalFallbackEntities(text));
    }

    async redact(text: string): Promise<RedactionResult> {
        const entities = await this.detectPiiEntities(text);
        const sorted = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
        let redactedText = text;

        for (const entity of sorted) {
            if (entity.BeginOffset < 0 || entity.EndOffset > redactedText.length) {
                continue;
            }
            const replacement =
                this.maskMode === "ASTERISK"
                    ? "*".repeat(Math.max(entity.EndOffset - entity.BeginOffset, 4))
                    : `[${entity.Type}]`;
            redactedText =
                redactedText.slice(0, entity.BeginOffset) +
                replacement +
                redactedText.slice(entity.EndOffset);
        }

        return {
            originalText: text,
            redactedText,
            entities,
        };
    }

    observe(prompt: string): PromptObservable<RedactionResult> {
        return new PromptObservable(() => this.redact(prompt));
    }

    chainWithEndpoint(
        endpoint: { chat: (opts: any) => Promise<any> },
        chatOptions: { prompt: string; [key: string]: any }
    ): PromptObservable<{ redaction: RedactionResult; response: any }> {
        return this.observe(chatOptions.prompt).pipe(async (redaction) => {
            const response = await endpoint.chat({
                ...chatOptions,
                prompt: redaction.redactedText,
            });
            return { redaction, response };
        });
    }

    private filterEntities(entities: PiiEntity[]): PiiEntity[] {
        return entities.filter((e) => {
            if (e.Score < this.minConfidenceScore) return false;
            if (this.entityTypes && this.entityTypes.length > 0) {
                return this.entityTypes.includes(e.Type);
            }
            return true;
        });
    }

    private detectLocalFallbackEntities(text: string): PiiEntity[] {
        const patterns: Array<{ type: string; regex: RegExp }> = [
            { type: "EMAIL", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
            { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
            { type: "PHONE", regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
            { type: "CREDIT_DEBIT_NUMBER", regex: /\b(?:\d[ -]*?){13,16}\b/g },
            { type: "AWS_ACCESS_KEY", regex: /\bAKIA[0-9A-Z]{16}\b/g },
        ];

        const found: PiiEntity[] = [];
        for (const { type, regex } of patterns) {
            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                found.push({
                    Type: type,
                    Score: 0.99,
                    BeginOffset: match.index,
                    EndOffset: match.index + match[0].length,
                });
            }
        }
        return found.sort((a, b) => a.BeginOffset - b.BeginOffset);
    }

    private signAwsRequest(
        host: string,
        payload: string,
        amzTarget: string
    ): Record<string, string> {
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const service = "comprehend";
        const contentType = "application/x-amz-json-1.1";
        const payloadHash = crypto.createHash("sha256").update(payload, "utf8").digest("hex");

        const canonicalHeaders =
            `content-type:${contentType}\n` +
            `host:${host}\n` +
            `x-amz-date:${amzDate}\n` +
            `x-amz-target:${amzTarget}\n`;
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
        const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
        const stringToSign = [
            algorithm,
            amzDate,
            credentialScope,
            crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
        ].join("\n");

        const kDate = crypto
            .createHmac("sha256", "AWS4" + this.secretAccessKey)
            .update(dateStamp)
            .digest();
        const kRegion = crypto.createHmac("sha256", kDate).update(this.region).digest();
        const kService = crypto.createHmac("sha256", kRegion).update(service).digest();
        const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
        const signature = crypto
            .createHmac("sha256", kSigning)
            .update(stringToSign, "utf8")
            .digest("hex");

        const authorizationHeader =
            `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": amzTarget,
            Authorization: authorizationHeader,
        };
        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }
        return headers;
    }
}

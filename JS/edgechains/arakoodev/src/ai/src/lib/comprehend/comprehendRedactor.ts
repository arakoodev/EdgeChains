import crypto from "crypto";

export interface PiiEntitySpan {
    BeginOffset: number;
    EndOffset: number;
    Score?: number;
    Type: string;
}

export interface ComprehendRedactorConfig {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    minScore?: number;
    maskMode?: "MASK" | "REPLACE_WITH_PII_ENTITY_TYPE";
    maskCharacter?: string;
    entityTypes?: string[];
    endpoint?: string;
}

export class ComprehendRedactor {
    private region: string;
    private accessKeyId: string;
    private secretAccessKey: string;
    private sessionToken?: string;
    private languageCode: string;
    private minScore: number;
    private maskMode: "MASK" | "REPLACE_WITH_PII_ENTITY_TYPE";
    private maskCharacter: string;
    private entityTypes?: string[];
    private endpoint?: string;

    constructor(config: ComprehendRedactorConfig = {}) {
        this.region = config.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = config.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.languageCode = config.languageCode || "en";
        this.minScore = config.minScore ?? 0.5;
        this.maskMode = config.maskMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        this.maskCharacter = config.maskCharacter || "*";
        this.entityTypes = config.entityTypes;
        this.endpoint = config.endpoint;
    }

    private signV4Headers(host: string, amzTarget: string, body: string): Record<string, string> {
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const service = "comprehend";
        const contentType = "application/x-amz-json-1.1";
        const payloadHash = crypto.createHash("sha256").update(body, "utf8").digest("hex");

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

        const hmac = (key: crypto.BinaryLike, data: string) =>
            crypto.createHmac("sha256", key).update(data, "utf8").digest();
        const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = hmac(kDate, this.region);
        const kService = hmac(kRegion, service);
        const kSigning = hmac(kService, "aws4_request");
        const signature = crypto
            .createHmac("sha256", kSigning)
            .update(stringToSign, "utf8")
            .digest("hex");

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": amzTarget,
            Authorization: `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        };
        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }
        return headers;
    }

    async detectPiiEntities(text: string, languageCode?: string): Promise<PiiEntitySpan[]> {
        if (!text) return [];
        const host = `comprehend.${this.region}.amazonaws.com`;
        const url = this.endpoint || `https://${host}/`;
        const body = JSON.stringify({
            Text: text,
            LanguageCode: languageCode || this.languageCode,
        });
        const headers = this.signV4Headers(host, "Comprehend_20171127.DetectPiiEntities", body);
        const response = await fetch(url, { method: "POST", headers, body });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(
                `AWS Comprehend DetectPiiEntities failed (${response.status}): ${errText}`
            );
        }
        const data = (await response.json()) as { Entities?: PiiEntitySpan[] };
        return data.Entities || [];
    }

    applyRedactionSpans(text: string, entities: PiiEntitySpan[]): string {
        if (!text || !entities || entities.length === 0) return text;
        const filtered = entities
            .filter((e) => (e.Score ?? 1) >= this.minScore)
            .filter((e) => !this.entityTypes || this.entityTypes.includes(e.Type))
            .sort((a, b) => b.BeginOffset - a.BeginOffset);

        let redacted = text;
        for (const entity of filtered) {
            const start = Math.max(0, entity.BeginOffset);
            const end = Math.min(redacted.length, entity.EndOffset);
            if (start >= end) continue;
            const replacement =
                this.maskMode === "MASK"
                    ? this.maskCharacter.repeat(end - start)
                    : `[${entity.Type}]`;
            redacted = redacted.slice(0, start) + replacement + redacted.slice(end);
        }
        return redacted;
    }

    async redactText(
        text: string,
        languageCode?: string
    ): Promise<{ redactedText: string; entities: PiiEntitySpan[] }> {
        const entities = await this.detectPiiEntities(text, languageCode);
        const redactedText = this.applyRedactionSpans(text, entities);
        return { redactedText, entities };
    }
}

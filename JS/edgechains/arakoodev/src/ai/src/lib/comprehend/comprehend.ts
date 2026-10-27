import axios from "axios";
import crypto from "crypto";

export interface PiiEntity {
    BeginOffset: number;
    EndOffset: number;
    Score: number;
    Type: string;
}

export interface AwsComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    minScore?: number;
    maskMode?: "TAG" | "MASK";
    maskCharacter?: string;
    entityTypes?: string[];
    endpoint?: string;
}

export class AwsComprehendPiiRedactor {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    languageCode: string;
    minScore: number;
    maskMode: "TAG" | "MASK";
    maskCharacter: string;
    entityTypes?: string[];
    endpoint: string;

    constructor(options: AwsComprehendOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey =
            options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0.5;
        this.maskMode = options.maskMode || "TAG";
        this.maskCharacter = options.maskCharacter || "*";
        this.entityTypes = options.entityTypes;
        this.endpoint =
            options.endpoint || `https://comprehend.${this.region}.amazonaws.com/`;
    }

    private signRequest(
        payloadStr: string,
        amzDate: string,
        dateStamp: string
    ): Record<string, string> {
        const service = "comprehend";
        const host = new URL(this.endpoint).host;
        const target = "Comprehend_20171127.DetectPiiEntities";
        const contentType = "application/x-amz-json-1.1";
        const payloadHash = crypto
            .createHash("sha256")
            .update(payloadStr, "utf8")
            .digest("hex");

        const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
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

        const hmac = (key: Buffer | string, data: string) =>
            crypto.createHmac("sha256", key).update(data, "utf8").digest();
        const kDate = hmac("AWS4" + this.secretAccessKey, dateStamp);
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
            "X-Amz-Target": target,
            Authorization: `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        };
        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }
        return headers;
    }

    async detectPiiEntities(text: string): Promise<PiiEntity[]> {
        const body = JSON.stringify({
            Text: text,
            LanguageCode: this.languageCode,
        });
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const headers = this.signRequest(body, amzDate, dateStamp);

        const res = await axios.post(this.endpoint, body, { headers });
        return res.data?.Entities ?? [];
    }

    applyRedaction(text: string, entities: PiiEntity[]): string {
        const filtered = entities
            .filter((e) => e.Score >= this.minScore)
            .filter((e) => !this.entityTypes || this.entityTypes.includes(e.Type))
            .sort((a, b) => b.BeginOffset - a.BeginOffset);

        let redacted = text;
        for (const entity of filtered) {
            const replacement =
                this.maskMode === "MASK"
                    ? this.maskCharacter.repeat(entity.EndOffset - entity.BeginOffset)
                    : `[${entity.Type}]`;
            redacted =
                redacted.slice(0, entity.BeginOffset) +
                replacement +
                redacted.slice(entity.EndOffset);
        }
        return redacted;
    }

    async redact(text: string): Promise<string> {
        const entities = await this.detectPiiEntities(text);
        return this.applyRedaction(text, entities);
    }

    chain<T = any>(
        prompt: string,
        endpointFn: (redactedPrompt: string) => Promise<T> | T
    ) {
        return {
            subscribe: async (observer: {
                next?: (value: T) => void;
                error?: (err: any) => void;
                complete?: () => void;
            }) => {
                try {
                    const redacted = await this.redact(prompt);
                    const result = await endpointFn(redacted);
                    observer.next?.(result);
                    observer.complete?.();
                } catch (err) {
                    observer.error?.(err);
                }
            },
            run: async (): Promise<T> => {
                const redacted = await this.redact(prompt);
                return await endpointFn(redacted);
            },
        };
    }
}

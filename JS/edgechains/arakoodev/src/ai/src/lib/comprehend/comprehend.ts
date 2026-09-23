import { createHash, createHmac } from "node:crypto";

export interface ComprehendEntity {
    BeginOffset: number;
    EndOffset: number;
    Score?: number;
    Type: string;
}

export interface ComprehendRedactorOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    endpoint?: string;
    fetch?: typeof globalThis.fetch;
    clock?: () => Date;
}

export interface RedactOptions {
    minimumScore?: number;
    types?: string[];
    replacement?: string;
}

export type PromptEndpoint<T> = (prompt: string) => Promise<T>;

const target = "Comprehend_20171127.DetectPiiEntities";

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
    return createHmac("sha256", key).update(value, "utf8").digest();
}

function amzDate(date: Date): { short: string; full: string } {
    const iso = date.toISOString().replace(/[-:]|\.\d{3}/g, "");
    return { short: iso.slice(0, 8), full: iso.slice(0, 15) + "Z" };
}

function canonicalHeaders(headers: Record<string, string>): {
    value: string;
    signed: string;
} {
    const names = Object.keys(headers).map((name) => name.toLowerCase()).sort();
    return {
        value: names.map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`).join(""),
        signed: names.join(";"),
    };
}

function signingKey(secret: string, date: string, region: string): Buffer {
    const dateKey = hmac(`AWS4${secret}`, date);
    const regionKey = hmac(dateKey, region);
    const serviceKey = hmac(regionKey, "comprehend");
    return hmac(serviceKey, "aws4_request");
}

/** Redacts PII from prompts through the AWS Comprehend DetectPiiEntities API. */
export class ComprehendRedactor {
    private readonly region: string;
    private readonly accessKeyId: string;
    private readonly secretAccessKey: string;
    private readonly sessionToken?: string;
    private readonly endpoint: string;
    private readonly fetchFn: typeof globalThis.fetch;
    private readonly clock: () => Date;

    constructor(options: ComprehendRedactorOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.endpoint = options.endpoint || `https://comprehend.${this.region}.amazonaws.com/`;
        this.fetchFn = options.fetch || globalThis.fetch;
        this.clock = options.clock || (() => new Date());
        if (!this.fetchFn) throw new Error("A fetch implementation is required");
    }

    /** Detect PII entities without exposing the source text in logs. */
    async detectPiiEntities(text: string, languageCode = "en"): Promise<ComprehendEntity[]> {
        if (!this.accessKeyId || !this.secretAccessKey) {
            throw new Error("AWS credentials are required for Comprehend redaction");
        }
        const url = new URL(this.endpoint);
        const body = JSON.stringify({ Text: text, LanguageCode: languageCode });
        const { short, full } = amzDate(this.clock());
        const headers: Record<string, string> = {
            "content-type": "application/x-amz-json-1.1",
            host: url.host,
            "x-amz-date": full,
            "x-amz-target": target,
        };
        if (this.sessionToken) headers["x-amz-security-token"] = this.sessionToken;
        const canonical = canonicalHeaders(headers);
        const request = [
            "POST",
            url.pathname || "/",
            url.search.slice(1),
            canonical.value,
            canonical.signed,
            sha256(body),
        ].join("\n");
        const scope = `${short}/${this.region}/comprehend/aws4_request`;
        const stringToSign = ["AWS4-HMAC-SHA256", full, scope, sha256(request)].join("\n");
        const signature = createHmac("sha256", signingKey(this.secretAccessKey, short, this.region))
            .update(stringToSign, "utf8")
            .digest("hex");
        headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${canonical.signed}, Signature=${signature}`;

        const response = await this.fetchFn(url, { method: "POST", headers, body });
        const responseText = await response.text();
        if (!response.ok) throw new Error(`Comprehend request failed (${response.status}): ${responseText}`);
        const payload = JSON.parse(responseText) as { Entities?: ComprehendEntity[] };
        return payload.Entities || [];
    }

    /** Replace detected PII spans, preserving the original prompt shape. */
    async redact(text: string, options: RedactOptions = {}): Promise<string> {
        const entities = await this.detectPiiEntities(text);
        const minimumScore = options.minimumScore ?? 0;
        const types = options.types ? new Set(options.types) : undefined;
        const selected = entities
            .filter((entity) => (entity.Score ?? 1) >= minimumScore && (!types || types.has(entity.Type)))
            .filter((entity) => entity.BeginOffset >= 0 && entity.EndOffset > entity.BeginOffset)
            .sort((left, right) => left.BeginOffset - right.BeginOffset);
        const nonOverlapping: ComprehendEntity[] = [];
        for (const entity of selected) {
            const previous = nonOverlapping[nonOverlapping.length - 1];
            if (!previous || entity.BeginOffset >= previous.EndOffset) nonOverlapping.push(entity);
        }
        const codePoints = Array.from(text);
        const replacement = options.replacement ?? "[REDACTED]";
        for (const entity of [...nonOverlapping].reverse()) {
            codePoints.splice(entity.BeginOffset, entity.EndOffset - entity.BeginOffset, replacement);
        }
        return codePoints.join("");
    }

    /** Redact a prompt before passing it to any existing endpoint function. */
    async protect<T>(prompt: string, endpoint: PromptEndpoint<T>, options?: RedactOptions): Promise<T> {
        return endpoint(await this.redact(prompt, options));
    }
}

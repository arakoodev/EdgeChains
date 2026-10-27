import axios, { AxiosInstance } from "axios";
import crypto from "crypto";

export type PiiRedactionMode = "TAG" | "MASK";

export interface PiiEntity {
    BeginOffset: number;
    EndOffset: number;
    Score: number;
    Type: string;
}

export interface ComprehendRedactOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
    /**
     * Full Comprehend endpoint URL. Defaults to
     * https://comprehend.{region}.amazonaws.com/ . Override it to point the
     * SDK at a mock for local demos or tests (no real AWS needed).
     */
    endpoint?: string;
    languageCode?: string;
}

const sha256Hex = (data: string | Buffer): string =>
    crypto.createHash("sha256").update(data).digest("hex");

const hmac = (secret: string | Buffer, data: string): Buffer =>
    crypto.createHmac("sha256", secret).update(data, "utf8").digest();

function buildSigV4Headers(opts: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    target: string;
    method: string;
    url: URL;
    payload: string;
    sessionToken?: string;
}): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const headers: Record<string, string> = {
        host: opts.url.host,
        "content-type": "application/x-amz-json-1.1",
        "x-amz-date": amzDate,
        "x-amz-target": opts.target,
    };
    if (opts.sessionToken) headers["x-amz-security-token"] = opts.sessionToken;
    const canonicalHeaders = Object.keys(headers)
        .sort()
        .map((k) => `${k}:${headers[k].trim()}\n`)
        .join("");
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalRequest = [
        opts.method,
        opts.url.pathname || "/",
        opts.url.search.replace(/^\?/, ""),
        canonicalHeaders,
        signedHeaders,
        sha256Hex(opts.payload),
    ].join("\n");
    const service = "comprehend";
    const scope = `${dateStamp}/${opts.region}/${service}/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
    let key = hmac(`AWS4${opts.secretAccessKey}`, dateStamp);
    key = hmac(key, opts.region);
    key = hmac(key, service);
    key = hmac(key, "aws4_request");
    const signature = crypto.createHmac("sha256", key).update(stringToSign, "utf8").digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return headers;
}

/**
 * Minimal observable-shaped wrapper around the redaction promise:
 * thenable, subscribable and async-iterable, so redaction can be chained
 * with the existing Endpoint classes of the SDK.
 */
export class RedactObservable {
    constructor(private readonly promise: Promise<string>) {}

    then<T = string, E = unknown>(
        onfulfilled?: (value: string) => T | PromiseLike<T>,
        onrejected?: (reason: E) => unknown,
    ): Promise<T | unknown> {
        return this.promise.then(onfulfilled, onrejected);
    }

    catch(onrejected?: (reason: unknown) => string | PromiseLike<string>): Promise<string> {
        return this.promise.catch(onrejected);
    }

    subscribe(onNext: (value: string) => void, onError?: (error: unknown) => void): void {
        this.promise.then(onNext, (e) => (onError ? onError(e) : Promise.reject(e)));
    }

    async *[Symbol.asyncIterator](): AsyncIterator<string> {
        yield await this.promise;
    }
}

/**
 * PII redaction backed by Amazon Comprehend (DetectPiiEntities), signable
 * with AWS Signature Version 4. Chained with existing Endpoint classes so
 * sensitive prompts are redacted before they reach the LLM (issue #290).
 */
export class ComprehendRedact {
    private readonly region: string;
    private readonly languageCode: string;
    private readonly endpointUrl: URL;
    private readonly accessKeyId?: string;
    private readonly secretAccessKey?: string;
    private readonly sessionToken?: string;
    private readonly http: AxiosInstance;

    constructor(opts: ComprehendRedactOptions = {}) {
        this.region = opts.region || process.env.AWS_REGION || "us-east-1";
        this.languageCode = opts.languageCode || "en";
        this.accessKeyId = opts.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
        this.secretAccessKey = opts.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
        this.sessionToken = opts.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.endpointUrl = opts.endpoint
            ? new URL(opts.endpoint)
            : new URL(`https://comprehend.${this.region}.amazonaws.com/`);
        this.http = axios.create();
    }

    /** Calls DetectPiiEntities and returns the detected PII entities. */
    async detectPii(text: string): Promise<PiiEntity[]> {
        if (!this.accessKeyId || !this.secretAccessKey) {
            throw new Error(
                "AWS credentials are required (accessKeyId/secretAccessKey or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY env vars).",
            );
        }
        const payload = JSON.stringify({ Text: text, LanguageCode: this.languageCode });
        const headers = buildSigV4Headers({
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.secretAccessKey,
            region: this.region,
            target: "AmazonComprehend.DetectPiiEntities",
            method: "POST",
            url: this.endpointUrl,
            payload,
            sessionToken: this.sessionToken,
        });
        const res = await this.http.post(this.endpointUrl.href, payload, { headers });
        const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        return (data?.Result ?? []) as PiiEntity[];
    }

    /** Redacts PII: TAG replaces with [TYPE], MASK replaces with *****. */
    async redactText(text: string, mode: PiiRedactionMode = "TAG"): Promise<string> {
        const entities = await this.detectPii(text);
        if (entities.length === 0) return text;
        const sorted = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
        let out = text;
        for (const e of sorted) {
            const replacement = mode === "MASK" ? "*****" : `[${e.Type}]`;
            out = out.slice(0, e.BeginOffset) + replacement + out.slice(e.EndOffset);
        }
        return out;
    }

    /** Observable-shaped entry point for chaining redaction in a pipeline. */
    redactObservable(text: string, mode: PiiRedactionMode = "TAG"): RedactObservable {
        return new RedactObservable(this.redactText(text, mode));
    }

    /**
     * Chain redaction with an existing Endpoint class (e.g. OpenAI):
     * the prompt is redacted first, then forwarded to endpoint.chat().
     */
    async chainWithEndpoint(
        endpoint: { chat: (opts: { prompt: string } & Record<string, unknown>) => Promise<unknown> },
        prompt: string,
        opts: { mode?: PiiRedactionMode } & Record<string, unknown> = {},
    ): Promise<unknown> {
        const { mode = "TAG", ...rest } = opts;
        const redacted = await this.redactText(prompt, mode);
        return endpoint.chat({ prompt: redacted, ...rest });
    }
}

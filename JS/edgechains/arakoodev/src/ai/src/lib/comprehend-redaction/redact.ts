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

/**
 * Maps a Unicode code point offset to a UTF-16 code unit offset.
 *
 * AWS Comprehend reports `BeginOffset`/`EndOffset` as positions in the UTF-8
 * code point sequence of the input (AWS API reference: "a multi-byte UTF-8
 * character maps to a single code point"), while JavaScript string methods
 * such as `slice()` index by UTF-16 code units. The two agree for ASCII/BMP
 * text, but diverge as soon as the text contains an astral character (emoji,
 * some CJK, ...): an astral character is one code point but two UTF-16 units,
 * so every offset after it is shifted. Slicing at the raw code point offset
 * would then cut the wrong span and leak part of the PII entity. This helper
 * converts the offset into the space `slice()` actually operates in.
 */
function codePointOffsetToUtf16(text: string, cpOffset: number): number {
    let utf16Offset = 0;
    let cp = 0;
    for (const ch of text) {
        if (cp >= cpOffset) break;
        utf16Offset += ch.length;
        cp += 1;
    }
    return utf16Offset;
}

// RFC 3986 percent-encoding for SigV4 canonicalization: everything except
// the unreserved set (A-Z a-z 0-9 - _ . ~) is percent-encoded.
// encodeURIComponent alone is not enough: it leaves !'()* unencoded.
function encodeRfc3986(value: string): string {
    return encodeURIComponent(value).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    );
}

// Fail closed on entity spans we cannot trust: an out-of-range, inverted or
// fractional offset, or a missing/empty Type, must reject the redaction
// instead of silently shifting replacement indices and leaking raw PII.
function validateEntitySpans(text: string, entities: PiiEntity[]): void {
    const cpLength = [...text].length;
    for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        const b = e.BeginOffset;
        const n = e.EndOffset;
        if (!Number.isInteger(b) || !Number.isInteger(n) || b < 0 || n > cpLength || b >= n) {
            throw new Error(
                `Unexpected PII entity #${i}: span [${b}, ${n}) is not inside code points [0, ${cpLength}): ` +
                    JSON.stringify(e)
            );
        }
        if (typeof e.Type !== "string" || e.Type.length === 0) {
            throw new Error(
                `Unexpected PII entity #${i}: Type must be a non-empty string: ` + JSON.stringify(e)
            );
        }
    }
}

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
    // SigV4 canonical form: query parameters percent-encoded per RFC 3986 and
    // sorted by name, then value. The raw search string is only valid when it
    // is already in that form, which an arbitrary endpoint URL is not
    // guaranteed to be. Literal '+' characters are protected as %2B before
    // parsing: URLSearchParams would otherwise decode them to spaces (form
    // encoding), but AWS/Smithy query semantics treat a wire '+' as a literal
    // '+'. Protecting first keeps the signed value equal to the sent value.
    const canonicalQuery = [...new URLSearchParams(opts.url.search.replace(/\+/g, "%2B")).entries()]
        .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
        .sort((a, b) =>
            a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1
        )
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
    const canonicalRequest = [
        opts.method,
        opts.url.pathname || "/",
        canonicalQuery,
        canonicalHeaders,
        signedHeaders,
        sha256Hex(opts.payload),
    ].join("\n");
    const service = "comprehend";
    const scope = `${dateStamp}/${opts.region}/${service}/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join(
        "\n"
    );
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

    then<T = string, E = never>(
        onfulfilled?: (value: string) => T | PromiseLike<T>,
        onrejected?: (reason: unknown) => E | PromiseLike<E>
    ): Promise<T | E> {
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
                "AWS credentials are required (accessKeyId/secretAccessKey or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY env vars)."
            );
        }
        const payload = JSON.stringify({
            Text: text,
            LanguageCode: this.languageCode,
        });
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
        const res = await this.http.post(this.endpointUrl.href, payload, {
            headers,
        });
        const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        // Real AWS DetectPiiEntities returns the entity list under `Entities`
        // (AWS API Reference); `Result` is kept as a fallback for local mocks.
        const entities = data?.Entities ?? data?.Result;
        // Fail closed: if the response carries no entity list we cannot confirm
        // the text was redacted, so throw instead of silently passing the
        // original (un-redacted) text downstream.
        if (!Array.isArray(entities)) {
            throw new Error(
                "Unexpected DetectPiiEntities response (no `Entities`/`Result` array): " +
                    JSON.stringify(data)
            );
        }
        return entities as PiiEntity[];
    }

    /**
     * Redacts PII: TAG replaces with [TYPE], MASK replaces with *****.
     *
     * Overlapping or duplicate spans are merged before replacing, and an
     * entity span that is out of range, inverted, fractional or missing its
     * Type rejects the whole call (fail closed), so the raw text never
     * passes through un-redacted.
     */
    async redactText(text: string, mode: PiiRedactionMode = "TAG"): Promise<string> {
        const entities = await this.detectPii(text);
        if (entities.length === 0) return text;
        validateEntitySpans(text, entities);
        // Convert AWS code point spans to UTF-16 spans (slice() operates in
        // UTF-16 units) and merge overlapping or duplicate intervals before
        // replacing. Merging matters because a replacement shifts every index
        // after it: without it, an outer span like ALL [0,10) covering EMAIL
        // [5,6) would be applied to an already-modified string and leak PII
        // (e.g. "[ALL]m" from "0123456789"). When spans overlap, the
        // accumulated (earlier-starting) span's label wins; MASK emits one
        // "*****" per merged span.
        const spans = entities.map((e) => ({
            begin: codePointOffsetToUtf16(text, e.BeginOffset),
            end: codePointOffsetToUtf16(text, e.EndOffset),
            type: e.Type,
        }));
        spans.sort((a, b) => a.begin - b.begin || b.end - a.end);
        const merged: { begin: number; end: number; type: string }[] = [];
        for (const s of spans) {
            const last = merged[merged.length - 1];
            if (last && s.begin < last.end) {
                last.end = Math.max(last.end, s.end);
            } else {
                merged.push({ begin: s.begin, end: s.end, type: s.type });
            }
        }
        let out = text;
        for (let i = merged.length - 1; i >= 0; i--) {
            const s = merged[i];
            const replacement = mode === "MASK" ? "*****" : `[${s.type}]`;
            out = out.slice(0, s.begin) + replacement + out.slice(s.end);
        }
        return out;
    }

    /** Observable-shaped entry point for chaining redaction in a pipeline. */
    redactObservable(text: string, mode: PiiRedactionMode = "TAG"): RedactObservable {
        return new RedactObservable(this.redactText(text, mode));
    }

    /**
     * Chain redaction with an existing Endpoint class (e.g. OpenAI):
     * the prompt (content) is redacted first, then forwarded to
     * endpoint.chat(). The redacted prompt always wins: a `prompt` key passed
     * inside opts is overwritten, so PII-bearing content cannot reach the
     * endpoint un-redacted. The remaining opts (model, temperature, ...) are
     * parameters and are passed through untouched. Keep PII-bearing content
     * in the `prompt` argument.
     */
    async chainWithEndpoint(
        endpoint: {
            chat: (opts: { prompt: string } & Record<string, unknown>) => Promise<unknown>;
        },
        prompt: string,
        opts: { mode?: PiiRedactionMode } & Record<string, unknown> = {}
    ): Promise<unknown> {
        const { mode = "TAG", ...rest } = opts;
        const redacted = await this.redactText(prompt, mode);
        // Spread rest first so the redacted prompt takes precedence even if the
        // caller also passed a `prompt` key inside opts.
        return endpoint.chat({ ...rest, prompt: redacted });
    }
}

import { createHash, createHmac } from "node:crypto";
import axios from "axios";

export interface ComprehendCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}

export interface ComprehendPiiEntity {
    Score: number;
    Type: string;
    BeginOffset: number;
    EndOffset: number;
}

export interface DetectPiiResponse {
    Entities?: ComprehendPiiEntity[];
}

export interface ComprehendRedactorConfig {
    region?: string;
    credentials?: ComprehendCredentials;
    /** Offline/test hook: replaces the live AWS DetectPiiEntities call. */
    mockCaller?: (text: string, languageCode?: string) => Promise<DetectPiiResponse>;
}

export interface RedactOptions {
    /** Only redact these PII types (e.g. ["SSN", "CREDIT_DEBIT_NUMBER"]); default: all detected. */
    piiEntityTypes?: string[];
    /** Character used to mask PII spans. @default "*" */
    maskChar?: string;
    /** "mask" replaces the span with maskChar; "replace_label" swaps it for `[ENTITY_TYPE]`. @default "mask" */
    mode?: "mask" | "replace_label";
    languageCode?: string;
    /** Return the original text instead of throwing when Comprehend fails. */
    fallbackToOriginal?: boolean;
}

export type NextFn<T> = (value: T) => void;
export interface PartialObserver<T> {
    next?: (value: T) => void;
    error?: (err: unknown) => void;
    complete?: () => void;
}
export interface ObservableLike<T> {
    subscribe(observer: NextFn<T> | PartialObserver<T>): { unsubscribe(): void };
}

function sha256Hex(data: string): string {
    return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
    return createHmac("sha256", key).update(data, "utf8").digest();
}

/** Minimal AWS SigV4 signer for the Comprehend JSON-1.1 RPC endpoint (no aws-sdk dependency). */
async function sigV4Post(
    region: string,
    credentials: ComprehendCredentials,
    target: string,
    payload: string
): Promise<{ status: number; data: DetectPiiResponse }> {
    const host = `comprehend.${region}.amazonaws.com`;
    const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, ""); // YYYYMMDD'T'HHMMSS'Z'
    const dateStamp = amzDate.slice(0, 8);

    const headerEntries: [string, string][] = [
        ["content-type", "application/x-amz-json-1.1"],
        ["host", host],
        ["x-amz-content-sha256", sha256Hex(payload)],
        ["x-amz-date", amzDate],
        ["x-amz-target", target],
    ];
    if (credentials.sessionToken) {
        headerEntries.push(["x-amz-security-token", credentials.sessionToken]);
    }
    headerEntries.sort((a, b) => (a[0] < b[0] ? -1 : 1));

    const canonicalHeaders = headerEntries.map(([k, v]) => `${k}:${v.trim()}\n`).join("");
    const signedHeaders = headerEntries.map(([k]) => k).join(";");
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256Hex(payload)}`;

    const scope = `${dateStamp}/${region}/comprehend/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;

    let signingKey: Buffer | string = hmacSha256(`AWS4${credentials.secretAccessKey}`, dateStamp);
    for (const part of [region, "comprehend", "aws4_request"]) {
        signingKey = hmacSha256(signingKey, part);
    }
    const signature = createHmac("sha256", signingKey as Buffer)
        .update(stringToSign, "utf8")
        .digest("hex");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const headers: Record<string, string> = { Authorization: authHeader };
    for (const [k, v] of headerEntries) headers[k] = v;

    try {
        const response = await axios.post(`https://${host}/`, payload, { headers });
        return { status: response.status, data: response.data as DetectPiiResponse };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(
                `AWS Comprehend request failed (${error.response?.status ?? error.code}): ${
                    typeof error.response?.data === "string"
                        ? error.response.data
                        : JSON.stringify(error.response?.data ?? error.message)
                }`
            );
        }
        throw error;
    }
}

/**
 * AWS Comprehend PII redaction utility, chainable with EdgeChains endpoint classes.
 * Works offline in tests via `mockCaller`; uses native SigV4 REST calls in production.
 */
export class ComprehendRedactor {
    private config: ComprehendRedactorConfig;

    constructor(config: ComprehendRedactorConfig = {}) {
        this.config = config;
    }

    /** Detect PII entities in the given text via AWS Comprehend DetectPiiEntities (or mockCaller). */
    async detectPii(text: string, languageCode = "en"): Promise<ComprehendPiiEntity[]> {
        if (this.config.mockCaller) {
            const response = await this.config.mockCaller(text, languageCode);
            return response.Entities ?? [];
        }
        const region =
            this.config.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
        const credentials =
            this.config.credentials ||
            (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
                ? {
                      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                      sessionToken: process.env.AWS_SESSION_TOKEN,
                  }
                : undefined);
        if (!credentials) {
            throw new Error(
                "AWS credentials are missing. Provide them in ComprehendRedactor config or via AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY environment variables."
            );
        }
        const response = await sigV4Post(
            region,
            credentials,
            "Comprehend_20171127.DetectPiiEntities",
            JSON.stringify({ Text: text, LanguageCode: languageCode })
        );
        return response.data.Entities ?? [];
    }

    /** Return `text` with detected PII spans masked or replaced by their `[LABEL]`. */
    async redact(text: string, options: RedactOptions = {}): Promise<string> {
        let entities: ComprehendPiiEntity[];
        try {
            entities = await this.detectPii(text, options.languageCode ?? "en");
        } catch (error) {
            if (options.fallbackToOriginal) return text;
            throw error;
        }
        const targets = (
            options.piiEntityTypes
                ? entities.filter((entity) => options.piiEntityTypes!.includes(entity.Type))
                : entities
        ).sort((a, b) => b.BeginOffset - a.BeginOffset); // apply back-to-front so earlier offsets stay valid
        // shortcut: offsets are treated as UTF-16 indices; upgrade to code-point mapping if astral-plane text misaligns.
        const maskChar = options.maskChar ?? "*";
        let redacted = text;
        for (const entity of targets) {
            const replacement =
                options.mode === "replace_label"
                    ? `[${entity.Type}]`
                    : maskChar.repeat(Math.max(entity.EndOffset - entity.BeginOffset, 1));
            redacted = redacted.slice(0, entity.BeginOffset) + replacement + redacted.slice(entity.EndOffset);
        }
        return redacted;
    }

    /** Wrap an LLM endpoint handler so every prompt is redacted before the endpoint sees it. */
    chain<T extends unknown[], R>(
        endpointHandler: (prompt: string, ...args: T) => Promise<R>,
        options: RedactOptions = {}
    ): (prompt: string, ...args: T) => Promise<R> {
        return async (prompt, ...args) => endpointHandler(await this.redact(prompt, options), ...args);
    }

    /**
     * Return an RxJS-compatible pipe operator (`source$.pipe(redactor.asObservable())`)
     * that maps every string emitted by the source through redact().
     */
    asObservable(options: RedactOptions = {}): (source: ObservableLike<string>) => ObservableLike<string> {
        const redactor = this; // regular subscribe() method would rebind this away from the class instance
        return (source) => ({
            subscribe(observer: NextFn<string> | PartialObserver<string>) {
                const next =
                    typeof observer === "function" ? observer : (value: string) => observer?.next?.(value);
                const error =
                    typeof observer === "function"
                        ? () => {}
                        : (err: unknown) => observer?.error?.(err);
                const complete = typeof observer === "function" ? () => {} : () => observer?.complete?.();
                // shortcut: serializes async redactions through a promise chain; switch to rxjs mergeMap once rxjs is a repo dependency.
                let queue = Promise.resolve();
                return source.subscribe({
                    next: (value) => {
                        queue = queue.then(() => redactor.redact(value, options)).then(next, error);
                    },
                    error,
                    complete: () => {
                        queue = queue.then(complete, error);
                    },
                });
            },
        });
    }
}

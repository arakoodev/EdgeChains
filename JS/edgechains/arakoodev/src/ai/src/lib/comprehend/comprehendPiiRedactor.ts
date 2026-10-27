import axios, { AxiosInstance } from "axios";
import * as crypto from "crypto";

export enum PiiRedactionMode {
    MASK = "MASK",
    ENTITY_TAG = "ENTITY_TAG",
}

export interface PiiEntity {
    BeginOffset: number;
    EndOffset: number;
    Score: number;
    Type: string;
}

export interface ComprehendPiiRedactorOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    minScore?: number;
    mode?: PiiRedactionMode;
    maskChar?: string;
    entityTypes?: string[];
    maxChunkBytes?: number;
    endpointUrl?: string;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
}

export interface PiiObserver<T> {
    next?: (value: T) => void;
    error?: (err: unknown) => void;
    complete?: () => void;
}

export type OperatorFunction<T, R> = (source: PiiObservable<T>) => PiiObservable<R>;

/**
 * Lightweight RxJS-compatible Observable class enabling reactive chaining
 * betweenComprehend PII redaction and EdgeChains AI Endpoint classes.
 */
export class PiiObservable<T> {
    constructor(
        private readonly subscribeFn: (observer: PiiObserver<T>) => void | (() => void)
    ) {}

    static fromPromise<U>(promiseFactory: () => Promise<U>): PiiObservable<U> {
        return new PiiObservable<U>((observer) => {
            let cancelled = false;
            promiseFactory()
                .then((val) => {
                    if (!cancelled) {
                        observer.next?.(val);
                        observer.complete?.();
                    }
                })
                .catch((err) => {
                    if (!cancelled) {
                        observer.error?.(err);
                    }
                });
            return () => {
                cancelled = true;
            };
        });
    }

    static of<U>(value: U): PiiObservable<U> {
        return new PiiObservable<U>((observer) => {
            observer.next?.(value);
            observer.complete?.();
        });
    }

    subscribe(
        observerOrNext?: PiiObserver<T> | ((value: T) => void),
        error?: (err: unknown) => void,
        complete?: () => void
    ): { unsubscribe: () => void } {
        const observer: PiiObserver<T> =
            typeof observerOrNext === "function"
                ? { next: observerOrNext, error, complete }
                : observerOrNext || {};
        const teardown = this.subscribeFn(observer);
        return {
            unsubscribe: () => {
                if (typeof teardown === "function") {
                    teardown();
                }
            },
        };
    }

    map<R>(project: (value: T) => R): PiiObservable<R> {
        return new PiiObservable<R>((observer) => {
            const sub = this.subscribe({
                next: (val) => {
                    try {
                        observer.next?.(project(val));
                    } catch (err) {
                        observer.error?.(err);
                    }
                },
                error: (err) => observer.error?.(err),
                complete: () => observer.complete?.(),
            });
            return () => sub.unsubscribe();
        });
    }

    switchMap<R>(project: (value: T) => PiiObservable<R> | Promise<R>): PiiObservable<R> {
        return new PiiObservable<R>((observer) => {
            let innerUnsub: (() => void) | undefined;
            const outerSub = this.subscribe({
                next: (val) => {
                    try {
                        const result = project(val);
                        const obs =
                            result instanceof PiiObservable
                                ? result
                                : PiiObservable.fromPromise(() => result);
                        innerUnsub?.();
                        const sub = obs.subscribe({
                            next: (innerVal) => observer.next?.(innerVal),
                            error: (err) => observer.error?.(err),
                            complete: () => observer.complete?.(),
                        });
                        innerUnsub = () => sub.unsubscribe();
                    } catch (err) {
                        observer.error?.(err);
                    }
                },
                error: (err) => observer.error?.(err),
                complete: () => {
                    // Completion is handled by the inner observable when active
                },
            });
            return () => {
                innerUnsub?.();
                outerSub.unsubscribe();
            };
        });
    }

    pipe<A>(op1: OperatorFunction<T, A>): PiiObservable<A>;
    pipe<A, B>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): PiiObservable<B>;
    pipe<A, B, C>(
        op1: OperatorFunction<T, A>,
        op2: OperatorFunction<A, B>,
        op3: OperatorFunction<B, C>
    ): PiiObservable<C>;
    pipe(...operations: Array<OperatorFunction<any, any>>): PiiObservable<any> {
        return operations.reduce((prev, fn) => fn(prev), this as PiiObservable<any>);
    }

    toPromise(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let lastVal: T;
            let hasVal = false;
            this.subscribe({
                next: (v) => {
                    lastVal = v;
                    hasVal = true;
                    resolve(v);
                },
                error: (err) => reject(err),
                complete: () => {
                    if (hasVal) resolve(lastVal!);
                },
            });
        });
    }
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Splits a UTF-8 string into chunks whose byte length never exceeds `maxBytes`,
 * without splitting multi-byte characters or surrogate pairs.
 */
export function splitTextIntoUtf8Chunks(
    text: string,
    maxBytes = 95000
): Array<{ chunk: string; charStartOffset: number }> {
    if (!text) return [];
    const totalBytes = Buffer.byteLength(text, "utf8");
    if (totalBytes <= maxBytes) {
        return [{ chunk: text, charStartOffset: 0 }];
    }

    const chunks: Array<{ chunk: string; charStartOffset: number }> = [];
    let currentStart = 0;
    let currentBytes = 0;
    let i = 0;

    while (i < text.length) {
        const codePoint = text.codePointAt(i)!;
        const charLen = codePoint > 0xffff ? 2 : 1;
        const charStr = text.slice(i, i + charLen);
        const charBytes = Buffer.byteLength(charStr, "utf8");

        if (currentBytes + charBytes > maxBytes && i > currentStart) {
            chunks.push({
                chunk: text.slice(currentStart, i),
                charStartOffset: currentStart,
            });
            currentStart = i;
            currentBytes = 0;
        }

        currentBytes += charBytes;
        i += charLen;
    }

    if (currentStart < text.length) {
        chunks.push({
            chunk: text.slice(currentStart),
            charStartOffset: currentStart,
        });
    }

    return chunks;
}

export class ComprehendPiiRedactor {
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
    readonly languageCode: string;
    readonly minScore: number;
    readonly mode: PiiRedactionMode;
    readonly maskChar: string;
    readonly entityTypes?: Set<string>;
    readonly maxChunkBytes: number;
    readonly endpointUrl: string;
    private readonly http: AxiosInstance;

    constructor(options: ComprehendPiiRedactorOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey =
            options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0.5;
        this.mode = options.mode || PiiRedactionMode.ENTITY_TAG;
        this.maskChar = options.maskChar || "*";
        this.entityTypes =
            options.entityTypes && options.entityTypes.length > 0
                ? new Set(options.entityTypes.map((t) => t.toUpperCase()))
                : undefined;
        this.maxChunkBytes = options.maxChunkBytes ?? 95000;
        this.endpointUrl =
            options.endpointUrl || `https://comprehend.${this.region}.amazonaws.com/`;
        this.http = axios.create();
    }

    private signAwsRequest(targetAction: string, payloadJson: string): Record<string, string> {
        const url = new URL(this.endpointUrl);
        const host = url.host;
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const service = "comprehend";
        const contentType = "application/x-amz-json-1.1";
        const amzTarget = `Comprehend_20171127.${targetAction}`;
        const payloadHash = sha256Hex(payloadJson);

        const canonicalHeaders =
            `content-type:${contentType}\n` +
            `host:${host}\n` +
            `x-amz-date:${amzDate}\n` +
            `x-amz-target:${amzTarget}\n`;
        const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
        const canonicalRequest = [
            "POST",
            url.pathname || "/",
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

        const authorization = `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            Host: host,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": amzTarget,
            Authorization: authorization,
        };
        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }
        return headers;
    }

    /**
     * Calls AWS Comprehend DetectPiiEntities across UTF-8 chunks and returns offset-adjusted entities.
     */
    async detectPiiEntities(text: string): Promise<PiiEntity[]> {
        if (!text) return [];
        const chunks = splitTextIntoUtf8Chunks(text, this.maxChunkBytes);
        const allEntities: PiiEntity[] = [];

        for (const { chunk, charStartOffset } of chunks) {
            const payload = JSON.stringify({
                Text: chunk,
                LanguageCode: this.languageCode,
            });
            const headers = this.signAwsRequest("DetectPiiEntities", payload);
            const res = await this.http.post(this.endpointUrl, payload, { headers });
            const rawEntities: PiiEntity[] = res.data?.Entities || [];

            for (const entity of rawEntities) {
                const scoreOk = (entity.Score ?? 1) >= this.minScore;
                const typeOk =
                    !this.entityTypes || this.entityTypes.has(String(entity.Type).toUpperCase());
                if (scoreOk && typeOk) {
                    allEntities.push({
                        BeginOffset: entity.BeginOffset + charStartOffset,
                        EndOffset: entity.EndOffset + charStartOffset,
                        Score: entity.Score,
                        Type: entity.Type,
                    });
                }
            }
        }

        return allEntities.sort((a, b) => a.BeginOffset - b.BeginOffset);
    }

    /**
     * Redacts detected PII entities from the input text using character offsets.
     */
    async redactText(text: string): Promise<RedactionResult> {
        const entities = await this.detectPiiEntities(text);
        if (entities.length === 0) {
            return { originalText: text, redactedText: text, entities: [] };
        }

        // Replace from right to left so character offsets remain valid
        const sortedDesc = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
        let redacted = text;

        for (const entity of sortedDesc) {
            const start = Math.max(0, entity.BeginOffset);
            const end = Math.min(redacted.length, entity.EndOffset);
            if (end <= start) continue;

            const replacement =
                this.mode === PiiRedactionMode.MASK
                    ? this.maskChar.repeat(end - start)
                    : `[${entity.Type}]`;

            redacted = redacted.slice(0, start) + replacement + redacted.slice(end);
        }

        return {
            originalText: text,
            redactedText: redacted,
            entities,
        };
    }

    /**
     * Returns an RxJS-compatible PiiObservable that emits the redacted prompt string.
     */
    redactPrompt$(prompt: string): PiiObservable<string> {
        return PiiObservable.fromPromise(async () => {
            const res = await this.redactText(prompt);
            return res.redactedText;
        });
    }
}

/**
 * Chainable Endpoint wrapper that redacts sensitive PII in prompts or message arrays
 * via AWS Comprehend and pipes the sanitized prompt into an EdgeChains AI Endpoint.
 */
export class RedactEndpoint {
    constructor(
        private readonly redactor: ComprehendPiiRedactor,
        private readonly targetEndpoint?: {
            chat?: (options: any) => Promise<any>;
            gptFn?: (prompt: string) => Promise<any>;
        }
    ) {}

    /**
     * Creates an observable pipeline that redacts `prompt` and chains into `targetEndpoint`.
     */
    chainChat$(chatOptions: {
        prompt?: string;
        messages?: Array<{ role: string; content: string; name?: string }>;
        [key: string]: any;
    }): PiiObservable<any> {
        return PiiObservable.fromPromise(async () => {
            const sanitizedOptions = { ...chatOptions };

            if (typeof sanitizedOptions.prompt === "string") {
                const { redactedText } = await this.redactor.redactText(sanitizedOptions.prompt);
                sanitizedOptions.prompt = redactedText;
            }

            if (Array.isArray(sanitizedOptions.messages)) {
                sanitizedOptions.messages = await Promise.all(
                    sanitizedOptions.messages.map(async (msg) => {
                        const { redactedText } = await this.redactor.redactText(msg.content);
                        return { ...msg, content: redactedText };
                    })
                );
            }

            if (!this.targetEndpoint) {
                return sanitizedOptions;
            }

            if (typeof this.targetEndpoint.chat === "function") {
                return this.targetEndpoint.chat(sanitizedOptions);
            }

            if (
                typeof this.targetEndpoint.gptFn === "function" &&
                typeof sanitizedOptions.prompt === "string"
            ) {
                return this.targetEndpoint.gptFn(sanitizedOptions.prompt);
            }

            return sanitizedOptions;
        });
    }
}

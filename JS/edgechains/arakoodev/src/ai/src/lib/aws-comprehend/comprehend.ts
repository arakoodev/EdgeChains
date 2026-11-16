import crypto from "crypto";

export type PiiRedactionMode = "ENTITY_TYPE" | "MASK_CHAR" | "FIXED_MASK";

export interface PiiEntity {
    Type: string;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface PiiEntityLabel {
    Name: string;
    Score: number;
}

export interface DetectPiiEntitiesResponse {
    Entities: PiiEntity[];
}

export interface ContainsPiiEntitiesResponse {
    Labels: PiiEntityLabel[];
}

export type ComprehendRequester = (
    target: "Comprehend_20171127.DetectPiiEntities" | "Comprehend_20171127.ContainsPiiEntities",
    payload: { Text: string; LanguageCode: string },
    headers: Record<string, string>,
    endpointUrl: string
) => Promise<any>;

export interface AWSComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    minScore?: number;
    entityTypes?: string[];
    redactionMode?: PiiRedactionMode;
    maskCharacter?: string;
    fixedMask?: string;
    maxChunkBytes?: number;
    endpointUrl?: string;
    requester?: ComprehendRequester;
}

export interface ChatMessageLike {
    role: string;
    content: string;
    name?: string;
}

export interface ChatOptionsLike {
    prompt?: string;
    messages?: ChatMessageLike[];
    [key: string]: any;
}

export interface ChatEndpointLike<TInput extends ChatOptionsLike = ChatOptionsLike, TOutput = any> {
    chat(options: TInput): Promise<TOutput>;
}

export interface Observer<T> {
    next: (value: T) => void;
    error?: (err: unknown) => void;
    complete?: () => void;
}

export type OperatorFunction<T, R> = (source: RedactionObservable<T>) => RedactionObservable<R>;

/**
 * Lightweight Observable implementation for chaining prompt redaction steps
 * with EdgeChains LLM Endpoint classes.
 */
export class RedactionObservable<T> {
    private readonly subscribeFn: (observer: Observer<T>) => void | (() => void);

    constructor(subscribeFn: (observer: Observer<T>) => void | (() => void)) {
        this.subscribeFn = subscribeFn;
    }

    static of<T>(...values: T[]): RedactionObservable<T> {
        return new RedactionObservable<T>((observer) => {
            try {
                for (const val of values) {
                    observer.next(val);
                }
                observer.complete?.();
            } catch (err) {
                observer.error?.(err);
            }
        });
    }

    static fromPromise<T>(promiseFactory: () => Promise<T>): RedactionObservable<T> {
        return new RedactionObservable<T>((observer) => {
            promiseFactory()
                .then((val) => {
                    observer.next(val);
                    observer.complete?.();
                })
                .catch((err) => {
                    observer.error?.(err);
                });
        });
    }

    subscribe(observerOrNext: Observer<T> | ((value: T) => void)): { unsubscribe: () => void } {
        const observer: Observer<T> =
            typeof observerOrNext === "function" ? { next: observerOrNext } : observerOrNext;
        const teardown = this.subscribeFn(observer);
        return {
            unsubscribe: () => {
                if (typeof teardown === "function") {
                    teardown();
                }
            },
        };
    }

    map<R>(project: (value: T) => R | Promise<R>): RedactionObservable<R> {
        return new RedactionObservable<R>((observer) => {
            const sub = this.subscribe({
                next: (val) => {
                    Promise.resolve(project(val))
                        .then((mapped) => observer.next(mapped))
                        .catch((err) => observer.error?.(err));
                },
                error: (err) => observer.error?.(err),
                complete: () => observer.complete?.(),
            });
            return () => sub.unsubscribe();
        });
    }

    pipe<A>(op1: OperatorFunction<T, A>): RedactionObservable<A>;
    pipe<A, B>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): RedactionObservable<B>;
    pipe<A, B, C>(
        op1: OperatorFunction<T, A>,
        op2: OperatorFunction<A, B>,
        op3: OperatorFunction<B, C>
    ): RedactionObservable<C>;
    pipe(...operations: Array<OperatorFunction<any, any>>): RedactionObservable<any> {
        return operations.reduce((prev, fn) => fn(prev), this as RedactionObservable<any>);
    }

    toPromise(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let lastValue: T;
            let hasValue = false;
            this.subscribe({
                next: (val) => {
                    lastValue = val;
                    hasValue = true;
                    resolve(val);
                },
                error: (err) => reject(err),
                complete: () => {
                    if (hasValue) {
                        resolve(lastValue);
                    }
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
 * Splits a UTF-8 string into chunks whose byte length does not exceed `maxBytes`.
 */
export function splitTextIntoUtf8Chunks(
    text: string,
    maxBytes: number = 95_000
): Array<{ chunk: string; charStartOffset: number }> {
    if (!text) return [];
    if (Buffer.byteLength(text, "utf8") <= maxBytes) {
        return [{ chunk: text, charStartOffset: 0 }];
    }

    const chunks: Array<{ chunk: string; charStartOffset: number }> = [];
    let currentChars: string[] = [];
    let currentBytes = 0;
    let chunkCharStart = 0;
    let charIndex = 0;

    for (const codePoint of text) {
        const cpBytes = Buffer.byteLength(codePoint, "utf8");
        if (currentBytes + cpBytes > maxBytes && currentChars.length > 0) {
            chunks.push({
                chunk: currentChars.join(""),
                charStartOffset: chunkCharStart,
            });
            currentChars = [];
            currentBytes = 0;
            chunkCharStart = charIndex;
        }
        currentChars.push(codePoint);
        currentBytes += cpBytes;
        charIndex += codePoint.length;
    }

    if (currentChars.length > 0) {
        chunks.push({
            chunk: currentChars.join(""),
            charStartOffset: chunkCharStart,
        });
    }

    return chunks;
}

/**
 * AWS Comprehend PII detection & redaction utility that can be chained with
 * EdgeChains Endpoint classes (`OpenAI`, `GeminiAI`, `LlamaAI`, etc.) as an Observable.
 */
export class AWSComprehend {
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
    readonly languageCode: string;
    readonly minScore: number;
    readonly entityTypes?: Set<string>;
    readonly redactionMode: PiiRedactionMode;
    readonly maskCharacter: string;
    readonly fixedMask: string;
    readonly maxChunkBytes: number;
    readonly endpointUrl: string;
    private readonly requester: ComprehendRequester;

    constructor(options: AWSComprehendOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0.5;
        this.entityTypes = options.entityTypes
            ? new Set(options.entityTypes.map((t) => t.toUpperCase()))
            : undefined;
        this.redactionMode = options.redactionMode || "ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || "*";
        this.fixedMask = options.fixedMask || "[REDACTED]";
        this.maxChunkBytes = options.maxChunkBytes ?? 95_000;
        this.endpointUrl =
            options.endpointUrl || `https://comprehend.${this.region}.amazonaws.com/`;
        this.requester = options.requester || this.defaultAwsRequester.bind(this);
    }

    /**
     * Builds AWS Signature Version 4 headers for an Amazon Comprehend JSON RPC call.
     */
    buildSignedHeaders(
        target: string,
        bodyJson: string,
        now: Date = new Date()
    ): Record<string, string> {
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const host = new URL(this.endpointUrl).host;
        const contentType = "application/x-amz-json-1.1";
        const payloadHash = sha256Hex(bodyJson);

        const headers: Record<string, string> = {
            "content-type": contentType,
            host,
            "x-amz-date": amzDate,
            "x-amz-target": target,
        };
        if (this.sessionToken) {
            headers["x-amz-security-token"] = this.sessionToken;
        }

        const sortedHeaderKeys = Object.keys(headers).sort();
        const canonicalHeaders = sortedHeaderKeys
            .map((k) => `${k}:${headers[k].trim()}\n`)
            .join("");
        const signedHeaders = sortedHeaderKeys.join(";");

        const canonicalRequest = [
            "POST",
            "/",
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

        headers["Authorization"] =
            `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        return headers;
    }

    private async defaultAwsRequester(
        target: "Comprehend_20171127.DetectPiiEntities" | "Comprehend_20171127.ContainsPiiEntities",
        payload: { Text: string; LanguageCode: string },
        headers: Record<string, string>,
        endpointUrl: string
    ): Promise<any> {
        const response = await fetch(endpointUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(
                `AWS Comprehend request failed with status ${response.status}: ${errBody}`
            );
        }
        return response.json();
    }

    /**
     * Calls Amazon Comprehend `ContainsPiiEntities` to inspect which PII entity labels appear in `text`.
     */
    async containsPiiEntities(text: string): Promise<PiiEntityLabel[]> {
        if (!text || !text.trim()) return [];
        const payload = { Text: text, LanguageCode: this.languageCode };
        const bodyJson = JSON.stringify(payload);
        const headers = this.buildSignedHeaders(
            "Comprehend_20171127.ContainsPiiEntities",
            bodyJson
        );
        const res: ContainsPiiEntitiesResponse = await this.requester(
            "Comprehend_20171127.ContainsPiiEntities",
            payload,
            headers,
            this.endpointUrl
        );
        return (res?.Labels || []).filter((label) => (label.Score ?? 1) >= this.minScore);
    }

    /**
     * Calls Amazon Comprehend `DetectPiiEntities` across UTF-8 safe chunks and returns offset-adjusted entities.
     */
    async detectPiiEntities(text: string): Promise<PiiEntity[]> {
        if (!text || !text.trim()) return [];
        const chunks = splitTextIntoUtf8Chunks(text, this.maxChunkBytes);
        const aggregated: PiiEntity[] = [];

        for (const { chunk, charStartOffset } of chunks) {
            const payload = { Text: chunk, LanguageCode: this.languageCode };
            const bodyJson = JSON.stringify(payload);
            const headers = this.buildSignedHeaders(
                "Comprehend_20171127.DetectPiiEntities",
                bodyJson
            );
            const res: DetectPiiEntitiesResponse = await this.requester(
                "Comprehend_20171127.DetectPiiEntities",
                payload,
                headers,
                this.endpointUrl
            );
            const entities = res?.Entities || [];
            for (const entity of entities) {
                const score = entity.Score ?? 1;
                const typeUpper = (entity.Type || "PII").toUpperCase();
                if (score < this.minScore) continue;
                if (this.entityTypes && !this.entityTypes.has(typeUpper)) continue;
                aggregated.push({
                    Type: typeUpper,
                    Score: score,
                    BeginOffset: entity.BeginOffset + charStartOffset,
                    EndOffset: entity.EndOffset + charStartOffset,
                });
            }
        }

        return aggregated;
    }

    private formatReplacement(entity: PiiEntity, originalSlice: string): string {
        if (this.redactionMode === "MASK_CHAR") {
            return this.maskCharacter.repeat(Math.max(originalSlice.length, 1));
        }
        if (this.redactionMode === "FIXED_MASK") {
            return this.fixedMask;
        }
        return `[${entity.Type || "PII"}]`;
    }

    /**
     * Redacts detected PII entities from `text` from right-to-left so character offsets stay aligned.
     */
    async redactText(text: string): Promise<string> {
        if (!text || !text.trim()) return text;
        const entities = await this.detectPiiEntities(text);
        if (entities.length === 0) return text;

        const sortedDescending = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
        let redacted = text;
        let lastReplacedStart = Number.POSITIVE_INFINITY;

        for (const entity of sortedDescending) {
            const start = Math.max(0, entity.BeginOffset);
            const end = Math.min(redacted.length, entity.EndOffset);
            if (start >= end || end > lastReplacedStart) {
                continue;
            }
            const originalSlice = redacted.slice(start, end);
            const replacement = this.formatReplacement(entity, originalSlice);
            redacted = redacted.slice(0, start) + replacement + redacted.slice(end);
            lastReplacedStart = start;
        }

        return redacted;
    }

    /**
     * Redacts PII across an array of chat messages (`{ role, content }`).
     */
    async redactMessages<T extends ChatMessageLike>(messages: T[]): Promise<T[]> {
        const redactedMessages: T[] = [];
        for (const msg of messages) {
            const redactedContent =
                typeof msg.content === "string"
                    ? await this.redactText(msg.content)
                    : msg.content;
            redactedMessages.push({
                ...msg,
                content: redactedContent,
            });
        }
        return redactedMessages;
    }

    /**
     * Redacts `prompt` and/or `messages` in an EdgeChains chat options payload.
     */
    async redactChatOptions<T extends ChatOptionsLike>(options: T): Promise<T> {
        const cloned: T = { ...options };
        if (typeof cloned.prompt === "string") {
            cloned.prompt = await this.redactText(cloned.prompt);
        }
        if (Array.isArray(cloned.messages)) {
            cloned.messages = await this.redactMessages(cloned.messages);
        }
        return cloned;
    }

    /**
     * Returns an Observable operator that redacts strings or chat option objects in a `RedactionObservable` pipeline.
     */
    asOperator<T extends string | ChatOptionsLike>(): OperatorFunction<T, T> {
        return (source: RedactionObservable<T>) =>
            source.map(async (item: T) => {
                if (typeof item === "string") {
                    return (await this.redactText(item)) as T;
                }
                return await this.redactChatOptions(item);
            });
    }

    /**
     * Chains this AWSComprehend redactor with any EdgeChains Endpoint (`OpenAI`, `GeminiAI`, `LlamaAI`, etc.),
     * returning a chained endpoint whose `.chatObservable(options)` and `.chat(options)` automatically redact
     * PII before invoking the downstream LLM endpoint.
     */
    chainWithEndpoint<TInput extends ChatOptionsLike, TOutput>(
        endpoint: ChatEndpointLike<TInput, TOutput>
    ): ChainedRedactionEndpoint<TInput, TOutput> {
        return new ChainedRedactionEndpoint(this, endpoint);
    }
}

/**
 * Chained Endpoint wrapper that composes `AWSComprehend` PII redaction with an EdgeChains LLM Endpoint
 * via `RedactionObservable`.
 */
export class ChainedRedactionEndpoint<TInput extends ChatOptionsLike = ChatOptionsLike, TOutput = any> {
    private readonly redactor: AWSComprehend;
    private readonly endpoint: ChatEndpointLike<TInput, TOutput>;

    constructor(redactor: AWSComprehend, endpoint: ChatEndpointLike<TInput, TOutput>) {
        this.redactor = redactor;
        this.endpoint = endpoint;
    }

    /**
     * Streams the request through an Observable pipeline:
     * `RedactionObservable.of(options) -> redactor.asOperator() -> endpoint.chat(...)`
     */
    chatObservable(options: TInput): RedactionObservable<TOutput> {
        return RedactionObservable.of(options)
            .pipe(this.redactor.asOperator<TInput>())
            .map((redactedOptions) => this.endpoint.chat(redactedOptions));
    }

    /**
     * Convenience Promise API backed by `chatObservable(options)`.
     */
    async chat(options: TInput): Promise<TOutput> {
        return this.chatObservable(options).toPromise();
    }
}

export { AWSComprehend as ComprehendPiiRedactor };

import crypto from "crypto";

export type ComprehendLanguageCode =
    | "en"
    | "es"
    | "fr"
    | "de"
    | "it"
    | "pt"
    | "ar"
    | "hi"
    | "ja"
    | "ko"
    | "zh"
    | "zh-TW";

export type PiiEntityType =
    | "ALL"
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
    | "AGE"
    | "USERNAME"
    | "PASSWORD"
    | "AWS_ACCESS_KEY"
    | "AWS_SECRET_KEY"
    | "IP_ADDRESS"
    | "MAC_ADDRESS"
    | "LICENSE_PLATE"
    | "VEHICLE_IDENTIFICATION_NUMBER"
    | "INTERNATIONAL_BANK_ACCOUNT_NUMBER"
    | "SWIFT_CODE"
    | "US_INDIVIDUAL_TAX_IDENTIFICATION_NUMBER"
    | "CA_SOCIAL_INSURANCE_NUMBER"
    | "UK_NATIONAL_INSURANCE_NUMBER";

export interface PiiEntity {
    BeginOffset: number;
    EndOffset: number;
    Score: number;
    Type: Exclude<PiiEntityType, "ALL"> | string;
}

export interface PiiEntityLabel {
    Name: Exclude<PiiEntityType, "ALL"> | string;
    Score: number;
}

export type RedactionMaskMode = "ENTITY_TYPE" | "MASK_CHAR" | "FIXED_MASK";

export type ComprehendAction = "DetectPiiEntities" | "ContainsPiiEntities";

export type ComprehendTransport = (
    action: ComprehendAction,
    payload: { Text: string; LanguageCode: ComprehendLanguageCode },
    headers: Record<string, string>,
    endpointUrl: string
) => Promise<any>;

export interface ComprehendRedactorOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: ComprehendLanguageCode;
    minScore?: number;
    entityTypes?: PiiEntityType[];
    maskMode?: RedactionMaskMode;
    maskCharacter?: string;
    fixedMask?: string;
    maxChunkBytes?: number;
    endpointUrl?: string;
    transport?: ComprehendTransport;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
    redactedCount: number;
}

export interface PromptLikeOptions {
    prompt?: string;
    messages?: Array<{ role: string; content: string; name?: string }>;
    [key: string]: any;
}

export interface ChainableEndpoint<TInput extends PromptLikeOptions = PromptLikeOptions, TOutput = any> {
    chat(options: TInput): Promise<TOutput>;
}

export type UnaryOperator<T, R> = (source: ComprehendObservable<T>) => ComprehendObservable<R>;

/**
 * Lightweight RxJS-compatible Observable supporting .pipe(), .map(), .chain(), and .subscribe()
 * so ComprehendPiiRedactor can be chained as an Observable pipeline with EdgeChains Endpoint classes.
 */
export class ComprehendObservable<T> {
    private readonly producer: (observer: {
        next: (value: T) => void;
        error?: (err: unknown) => void;
        complete?: () => void;
    }) => void | Promise<void>;

    constructor(
        producer: (observer: {
            next: (value: T) => void;
            error?: (err: unknown) => void;
            complete?: () => void;
        }) => void | Promise<void>
    ) {
        this.producer = producer;
    }

    static of<U>(...items: U[]): ComprehendObservable<U> {
        return new ComprehendObservable<U>((observer) => {
            try {
                for (const item of items) {
                    observer.next(item);
                }
                observer.complete?.();
            } catch (err) {
                observer.error?.(err);
            }
        });
    }

    static fromPromise<U>(promiseFactory: () => Promise<U>): ComprehendObservable<U> {
        return new ComprehendObservable<U>(async (observer) => {
            try {
                const value = await promiseFactory();
                observer.next(value);
                observer.complete?.();
            } catch (err) {
                observer.error?.(err);
            }
        });
    }

    map<R>(project: (value: T) => R | Promise<R>): ComprehendObservable<R> {
        return new ComprehendObservable<R>((observer) => {
            const pending: Promise<void>[] = [];
            this.subscribe({
                next: (val) => {
                    const p = Promise.resolve()
                        .then(() => project(val))
                        .then((mapped) => {
                            observer.next(mapped);
                        })
                        .catch((err) => {
                            observer.error?.(err);
                        });
                    pending.push(p);
                },
                error: (err) => observer.error?.(err),
                complete: () => {
                    Promise.all(pending)
                        .then(() => observer.complete?.())
                        .catch((err) => observer.error?.(err));
                },
            });
        });
    }

    pipe<A>(op1: UnaryOperator<T, A>): ComprehendObservable<A>;
    pipe<A, B>(op1: UnaryOperator<T, A>, op2: UnaryOperator<A, B>): ComprehendObservable<B>;
    pipe<A, B, C>(
        op1: UnaryOperator<T, A>,
        op2: UnaryOperator<A, B>,
        op3: UnaryOperator<B, C>
    ): ComprehendObservable<C>;
    pipe(...operations: Array<UnaryOperator<any, any>>): ComprehendObservable<any> {
        return operations.reduce((prev, fn) => fn(prev), this as ComprehendObservable<any>);
    }

    subscribe(
        observerOrNext:
            | ((value: T) => void)
            | {
                  next: (value: T) => void;
                  error?: (err: unknown) => void;
                  complete?: () => void;
              }
    ): void {
        const observer =
            typeof observerOrNext === "function"
                ? { next: observerOrNext }
                : observerOrNext;
        Promise.resolve(this.producer(observer)).catch((err) => {
            observer.error?.(err);
        });
    }

    firstValue(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let settled = false;
            this.subscribe({
                next: (value) => {
                    if (!settled) {
                        settled = true;
                        resolve(value);
                    }
                },
                error: (err) => {
                    if (!settled) {
                        settled = true;
                        reject(err);
                    }
                },
                complete: () => {
                    if (!settled) {
                        settled = true;
                        reject(new Error("Observable completed without emitting a value"));
                    }
                },
            });
        });
    }
}

function sha256Hex(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * Splits a string into UTF-8 byte-bounded chunks without splitting surrogate pairs or multi-byte characters.
 * AWS Comprehend DetectPiiEntities has a 100,000 UTF-8 byte limit per call.
 */
export function splitTextIntoUtf8Chunks(
    text: string,
    maxBytes: number = 95_000
): Array<{ chunk: string; charStartOffset: number }> {
    if (!text) {
        return [];
    }
    if (Buffer.byteLength(text, "utf8") <= maxBytes) {
        return [{ chunk: text, charStartOffset: 0 }];
    }

    const chunks: Array<{ chunk: string; charStartOffset: number }> = [];
    let currentChars: string[] = [];
    let currentBytes = 0;
    let chunkCharStart = 0;
    let charIndex = 0;

    for (const codePointChar of text) {
        const charByteLen = Buffer.byteLength(codePointChar, "utf8");
        const charUnitLen = codePointChar.length;

        if (currentBytes + charByteLen > maxBytes && currentChars.length > 0) {
            chunks.push({
                chunk: currentChars.join(""),
                charStartOffset: chunkCharStart,
            });
            currentChars = [];
            currentBytes = 0;
            chunkCharStart = charIndex;
        }

        currentChars.push(codePointChar);
        currentBytes += charByteLen;
        charIndex += charUnitLen;
    }

    if (currentChars.length > 0) {
        chunks.push({
            chunk: currentChars.join(""),
            charStartOffset: chunkCharStart,
        });
    }

    return chunks;
}

export class ComprehendPiiRedactor {
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
    readonly languageCode: ComprehendLanguageCode;
    readonly minScore: number;
    readonly entityTypes: Set<PiiEntityType>;
    readonly maskMode: RedactionMaskMode;
    readonly maskCharacter: string;
    readonly fixedMask: string;
    readonly maxChunkBytes: number;
    readonly endpointUrl: string;
    private readonly transport: ComprehendTransport;

    constructor(options: ComprehendRedactorOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0.5;
        this.entityTypes = new Set<PiiEntityType>(options.entityTypes || ["ALL"]);
        this.maskMode = options.maskMode || "ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || "*";
        this.fixedMask = options.fixedMask || "[REDACTED]";
        this.maxChunkBytes = options.maxChunkBytes || 95_000;
        this.endpointUrl =
            options.endpointUrl || `https://comprehend.${this.region}.amazonaws.com/`;
        this.transport = options.transport || this.defaultAwsTransport.bind(this);
    }

    /**
     * Generates AWS Signature Version 4 headers for Amazon Comprehend JSON 1.1 RPC requests.
     */
    buildSigV4Headers(
        action: ComprehendAction,
        bodyJson: string,
        now: Date = new Date()
    ): Record<string, string> {
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const host = new URL(this.endpointUrl).host;
        const contentType = "application/x-amz-json-1.1";
        const amzTarget = `Comprehend_20171127.${action}`;
        const payloadHash = sha256Hex(bodyJson);

        const canonicalHeadersMap: Record<string, string> = {
            "content-type": contentType,
            host: host,
            "x-amz-date": amzDate,
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
            "/",
            "",
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join("\n");

        const algorithm = "AWS4-HMAC-SHA256";
        const credentialScope = `${dateStamp}/${this.region}/comprehend/aws4_request`;
        const stringToSign = [
            algorithm,
            amzDate,
            credentialScope,
            sha256Hex(canonicalRequest),
        ].join("\n");

        const kDate = hmacSha256(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = hmacSha256(kDate, this.region);
        const kService = hmacSha256(kRegion, "comprehend");
        const kSigning = hmacSha256(kService, "aws4_request");
        const signature = crypto
            .createHmac("sha256", kSigning)
            .update(stringToSign, "utf8")
            .digest("hex");

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            Host: host,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": amzTarget,
            Authorization: `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        };

        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }

        return headers;
    }

    private async defaultAwsTransport(
        _action: ComprehendAction,
        payload: { Text: string; LanguageCode: ComprehendLanguageCode },
        headers: Record<string, string>,
        endpointUrl: string
    ): Promise<any> {
        const response = await fetch(endpointUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`AWS Comprehend HTTP ${response.status}: ${errText}`);
        }
        return await response.json();
    }

    private shouldRedactEntity(entity: PiiEntity): boolean {
        if (entity.Score < this.minScore) {
            return false;
        }
        if (this.entityTypes.has("ALL")) {
            return true;
        }
        return this.entityTypes.has(entity.Type as PiiEntityType);
    }

    private formatReplacement(entity: PiiEntity, rawSlice: string): string {
        if (this.maskMode === "MASK_CHAR") {
            const char = this.maskCharacter || "*";
            return char.repeat(Math.max(1, Array.from(rawSlice).length));
        }
        if (this.maskMode === "FIXED_MASK") {
            return this.fixedMask;
        }
        return `[${entity.Type}]`;
    }

    /**
     * Calls Amazon Comprehend ContainsPiiEntities API to quickly inspect whether a text contains PII labels.
     */
    async containsPiiEntities(text: string): Promise<PiiEntityLabel[]> {
        if (!text || !text.trim()) {
            return [];
        }
        const payload = { Text: text, LanguageCode: this.languageCode };
        const bodyJson = JSON.stringify(payload);
        const headers = this.buildSigV4Headers("ContainsPiiEntities", bodyJson);
        const data = await this.transport(
            "ContainsPiiEntities",
            payload,
            headers,
            this.endpointUrl
        );
        const labels: PiiEntityLabel[] = Array.isArray(data?.Labels) ? data.Labels : [];
        return labels.filter((l) => {
            if (l.Score < this.minScore) return false;
            if (this.entityTypes.has("ALL")) return true;
            return this.entityTypes.has(l.Name as PiiEntityType);
        });
    }

    /**
     * Calls Amazon Comprehend DetectPiiEntities API (with automatic UTF-8 chunking for texts > 100KB)
     * and returns all matched PII entity offsets filtered by minScore and entityTypes.
     */
    async detectPiiEntities(text: string): Promise<PiiEntity[]> {
        if (!text || !text.trim()) {
            return [];
        }

        const chunks = splitTextIntoUtf8Chunks(text, this.maxChunkBytes);
        const detected: PiiEntity[] = [];

        for (const { chunk, charStartOffset } of chunks) {
            const payload = { Text: chunk, LanguageCode: this.languageCode };
            const bodyJson = JSON.stringify(payload);
            const headers = this.buildSigV4Headers("DetectPiiEntities", bodyJson);
            const data = await this.transport(
                "DetectPiiEntities",
                payload,
                headers,
                this.endpointUrl
            );
            const entities: PiiEntity[] = Array.isArray(data?.Entities) ? data.Entities : [];
            for (const entity of entities) {
                const adjusted: PiiEntity = {
                    BeginOffset: entity.BeginOffset + charStartOffset,
                    EndOffset: entity.EndOffset + charStartOffset,
                    Score: entity.Score,
                    Type: entity.Type,
                };
                if (this.shouldRedactEntity(adjusted)) {
                    detected.push(adjusted);
                }
            }
        }

        return detected.sort((a, b) => a.BeginOffset - b.BeginOffset);
    }

    /**
     * Detects and redacts PII entities in a string while handling overlapping spans safely.
     */
    async redactWithDetails(text: string): Promise<RedactionResult> {
        if (!text) {
            return { originalText: text, redactedText: text, entities: [], redactedCount: 0 };
        }

        const entities = await this.detectPiiEntities(text);
        if (entities.length === 0) {
            return { originalText: text, redactedText: text, entities: [], redactedCount: 0 };
        }

        // Normalize and merge/skip overlapping intervals
        const nonOverlapping: PiiEntity[] = [];
        for (const ent of entities) {
            const begin = Math.max(0, Math.min(text.length, ent.BeginOffset));
            const end = Math.max(begin, Math.min(text.length, ent.EndOffset));
            if (end <= begin) continue;

            const prev = nonOverlapping[nonOverlapping.length - 1];
            if (!prev || begin >= prev.EndOffset) {
                nonOverlapping.push({ ...ent, BeginOffset: begin, EndOffset: end });
            } else if (end > prev.EndOffset && ent.Score >= prev.Score) {
                prev.EndOffset = end;
                prev.Type = ent.Type;
                prev.Score = ent.Score;
            }
        }

        let cursor = 0;
        const parts: string[] = [];
        for (const ent of nonOverlapping) {
            if (ent.BeginOffset > cursor) {
                parts.push(text.slice(cursor, ent.BeginOffset));
            }
            const rawSlice = text.slice(ent.BeginOffset, ent.EndOffset);
            parts.push(this.formatReplacement(ent, rawSlice));
            cursor = ent.EndOffset;
        }
        if (cursor < text.length) {
            parts.push(text.slice(cursor));
        }

        return {
            originalText: text,
            redactedText: parts.join(""),
            entities: nonOverlapping,
            redactedCount: nonOverlapping.length,
        };
    }

    /**
     * Convenience method returning the redacted text string directly.
     */
    async redactText(text: string): Promise<string> {
        const res = await this.redactWithDetails(text);
        return res.redactedText;
    }

    /**
     * Redacts sensitive PII across an EdgeChains Endpoint options object (`prompt` and/or `messages[]`).
     */
    async redactPromptOptions<T extends PromptLikeOptions>(options: T): Promise<T> {
        const cloned: T = { ...options };

        if (typeof cloned.prompt === "string") {
            cloned.prompt = await this.redactText(cloned.prompt);
        }

        if (Array.isArray(cloned.messages)) {
            cloned.messages = await Promise.all(
                cloned.messages.map(async (msg) => ({
                    ...msg,
                    content:
                        typeof msg.content === "string"
                            ? await this.redactText(msg.content)
                            : msg.content,
                }))
            );
        }

        return cloned;
    }

    /**
     * Emits redacted text as an Observable stream.
     */
    redact$(text: string): ComprehendObservable<RedactionResult> {
        return ComprehendObservable.fromPromise(() => this.redactWithDetails(text));
    }

    /**
     * RxJS-style pipeable operator that redacts incoming strings or PromptLikeOptions in an Observable pipeline.
     */
    asOperator<T extends string | PromptLikeOptions>(): UnaryOperator<T, T> {
        return (source: ComprehendObservable<T>) =>
            source.map(async (item: T) => {
                if (typeof item === "string") {
                    return (await this.redactText(item)) as T;
                }
                return await this.redactPromptOptions(item);
            });
    }

    /**
     * Chains this ComprehendPiiRedactor with any EdgeChains Endpoint class (e.g. OpenAI, GeminiAI, Palm2AI)
     * so prompts and messages are automatically scrubbed of PII before invoking the downstream LLM.
     */
    chain<TInput extends PromptLikeOptions, TOutput>(
        endpoint: ChainableEndpoint<TInput, TOutput>
    ): RedactedEndpoint<TInput, TOutput> {
        return new RedactedEndpoint(this, endpoint);
    }
}

/**
 * Chainable Endpoint wrapper that sanitizes prompts/messages via ComprehendPiiRedactor
 * and exposes both Promise-based `.chat()` and Observable-based `.chat$()` execution.
 */
export class RedactedEndpoint<TInput extends PromptLikeOptions = PromptLikeOptions, TOutput = any> {
    public readonly redactor: ComprehendPiiRedactor;
    public readonly endpoint: ChainableEndpoint<TInput, TOutput>;

    constructor(
        redactor: ComprehendPiiRedactor,
        endpoint: ChainableEndpoint<TInput, TOutput>
    ) {
        this.redactor = redactor;
        this.endpoint = endpoint;
    }

    async chat(options: TInput): Promise<TOutput> {
        const sanitized = await this.redactor.redactPromptOptions(options);
        return await this.endpoint.chat(sanitized);
    }

    chat$(options: TInput): ComprehendObservable<TOutput> {
        return ComprehendObservable.of(options)
            .pipe(this.redactor.asOperator<TInput>())
            .map((sanitized) => this.endpoint.chat(sanitized));
    }
}

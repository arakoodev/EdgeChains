import crypto from "node:crypto";

export type PiiEntityType =
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
    | "ALL"
    | (string & {});

export interface PiiEntity {
    Type: PiiEntityType;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface DetectPiiEntitiesResponse {
    Entities: PiiEntity[];
}

export type PiiMaskMode = "ENTITY_TYPE" | "CHARACTER";

export interface AwsComprehendRedactorOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    endpoint?: string;
    languageCode?: string;
    minScore?: number;
    piiTypes?: PiiEntityType[];
    maskMode?: PiiMaskMode;
    maskCharacter?: string;
    replacer?: (entity: PiiEntity, matchedText: string) => string;
    fallbackToRegex?: boolean;
    fetchImpl?: typeof fetch;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
}

export interface Observer<T> {
    next?: (value: T) => void;
    error?: (err: unknown) => void;
    complete?: () => void;
}

export type OperatorFn<T, R> = (source: PiiObservable<T>) => PiiObservable<R>;

/**
 * Lightweight Observable implementation for chaining PII redaction steps
 * with EdgeChains LLM endpoints without requiring external stream libraries.
 */
export class PiiObservable<T> {
    private readonly producer: (observer: Required<Observer<T>>) => Promise<void> | void;

    constructor(producer: (observer: Required<Observer<T>>) => Promise<void> | void) {
        this.producer = producer;
    }

    static of<itemT>(value: itemT | Promise<itemT>): PiiObservable<itemT> {
        return new PiiObservable<itemT>(async (observer) => {
            try {
                const resolved = await value;
                observer.next(resolved);
                observer.complete();
            } catch (err) {
                observer.error(err);
            }
        });
    }

    subscribe(
        observerOrNext?: Observer<T> | ((value: T) => void),
        error?: (err: unknown) => void,
        complete?: () => void
    ): { unsubscribe: () => void } {
        let active = true;
        const rawObserver: Observer<T> =
            typeof observerOrNext === "function"
                ? { next: observerOrNext, error, complete }
                : observerOrNext || {};

        const safeObserver: Required<Observer<T>> = {
            next: (val: T) => {
                if (active && rawObserver.next) {
                    rawObserver.next(val);
                }
            },
            error: (err: unknown) => {
                if (active && rawObserver.error) {
                    rawObserver.error(err);
                }
            },
            complete: () => {
                if (active && rawObserver.complete) {
                    rawObserver.complete();
                }
            },
        };

        Promise.resolve()
            .then(() => this.producer(safeObserver))
            .catch((err) => safeObserver.error(err));

        return {
            unsubscribe: () => {
                active = false;
            },
        };
    }

    map<R>(project: (value: T) => R | Promise<R>): PiiObservable<R> {
        return new PiiObservable<R>((observer) => {
            let pending = Promise.resolve();
            this.subscribe({
                next: (val) => {
                    pending = pending
                        .then(() => project(val))
                        .then((mapped) => observer.next(mapped))
                        .catch((err) => observer.error(err));
                },
                error: (err) => observer.error(err),
                complete: () => {
                    pending
                        .then(() => observer.complete())
                        .catch((err) => observer.error(err));
                },
            });
        });
    }

    pipe<R>(op1: OperatorFn<T, R>): PiiObservable<R>;
    pipe<A, R>(op1: OperatorFn<T, A>, op2: OperatorFn<A, R>): PiiObservable<R>;
    pipe<A, B, R>(
        op1: OperatorFn<T, A>,
        op2: OperatorFn<A, B>,
        op3: OperatorFn<B, R>
    ): PiiObservable<R>;
    pipe(...operations: Array<OperatorFn<any, any>>): PiiObservable<any> {
        return operations.reduce((prev, fn) => fn(prev), this as PiiObservable<any>);
    }

    toPromise(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let lastValue: T;
            let hasValue = false;
            this.subscribe({
                next: (val) => {
                    lastValue = val;
                    hasValue = true;
                },
                error: (err) => reject(err),
                complete: () => {
                    if (hasValue) {
                        resolve(lastValue);
                    } else {
                        reject(new Error("Observable completed without emitting a value"));
                    }
                },
            });
        });
    }
}

export interface ChatLikeEndpoint<TOptions = any, TResponse = any> {
    chat: (options: TOptions) => Promise<TResponse>;
}

const REGEX_FALLBACK_PATTERNS: Array<{ type: PiiEntityType; regex: RegExp; score: number }> = [
    {
        type: "EMAIL",
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        score: 0.99,
    },
    {
        type: "SSN",
        regex: /\b\d{3}-\d{2}-\d{4}\b/g,
        score: 0.99,
    },
    {
        type: "CREDIT_DEBIT_NUMBER",
        regex: /\b(?:\d[ -]*?){13,16}\b/g,
        score: 0.95,
    },
    {
        type: "PHONE",
        regex: /\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}\b/g,
        score: 0.95,
    },
    {
        type: "IP_ADDRESS",
        regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        score: 0.95,
    },
    {
        type: "AWS_ACCESS_KEY",
        regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
        score: 0.99,
    },
];

function sha256Hex(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function formatAmzDate(date: Date): { amzDate: string; dateStamp: string } {
    const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
    return {
        amzDate: iso,
        dateStamp: iso.slice(0, 8),
    };
}

/**
 * AWS Comprehend PII detection and prompt redaction utility that can be
 * chained with EdgeChains Endpoints (OpenAI, GeminiAI, LlamaAI, Palm2Endpoint)
 * via Observable pipelines or wrapped endpoint proxies.
 */
export class AwsComprehendRedactor {
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
    readonly endpoint: string;
    readonly languageCode: string;
    readonly minScore: number;
    readonly piiTypes?: Set<string>;
    readonly maskMode: PiiMaskMode;
    readonly maskCharacter: string;
    readonly replacer?: (entity: PiiEntity, matchedText: string) => string;
    readonly fallbackToRegex: boolean;
    private readonly fetchFn: typeof fetch;

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.region =
            options.region ||
            (typeof process !== "undefined" ? process.env?.AWS_REGION : undefined) ||
            "us-east-1";
        this.accessKeyId =
            options.accessKeyId ||
            (typeof process !== "undefined" ? process.env?.AWS_ACCESS_KEY_ID : undefined) ||
            "";
        this.secretAccessKey =
            options.secretAccessKey ||
            (typeof process !== "undefined" ? process.env?.AWS_SECRET_ACCESS_KEY : undefined) ||
            "";
        this.sessionToken =
            options.sessionToken ||
            (typeof process !== "undefined" ? process.env?.AWS_SESSION_TOKEN : undefined);
        this.endpoint = (
            options.endpoint || `https://comprehend.${this.region}.amazonaws.com/`
        ).replace(/\/?$/, "/");
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0.5;
        this.piiTypes =
            options.piiTypes && !options.piiTypes.includes("ALL")
                ? new Set(options.piiTypes)
                : undefined;
        this.maskMode = options.maskMode || "ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || "*";
        this.replacer = options.replacer;
        this.fallbackToRegex = options.fallbackToRegex ?? false;
        this.fetchFn = options.fetchImpl || globalThis.fetch.bind(globalThis);
    }

    /**
     * Generates AWS Signature Version 4 headers for Comprehend JSON-RPC requests.
     */
    signRequestHeaders(payload: string, now: Date = new Date()): Record<string, string> {
        const parsedUrl = new URL(this.endpoint);
        const host = parsedUrl.host;
        const { amzDate, dateStamp } = formatAmzDate(now);
        const target = "Comprehend_20171127.DetectPiiEntities";
        const contentType = "application/x-amz-json-1.1";
        const payloadHash = sha256Hex(payload);

        const canonicalHeadersMap: Record<string, string> = {
            "content-type": contentType,
            host,
            "x-amz-date": amzDate,
            "x-amz-target": target,
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
            parsedUrl.pathname || "/",
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
        const signature = crypto
            .createHmac("sha256", kSigning)
            .update(stringToSign, "utf8")
            .digest("hex");

        const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            Host: host,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": target,
            Authorization: authorization,
        };
        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }
        return headers;
    }

    /**
     * Detects PII entities locally using regex patterns (used when fallbackToRegex is enabled).
     */
    detectPiiWithRegex(text: string): PiiEntity[] {
        const entities: PiiEntity[] = [];
        for (const pattern of REGEX_FALLBACK_PATTERNS) {
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                entities.push({
                    Type: pattern.type,
                    Score: pattern.score,
                    BeginOffset: match.index,
                    EndOffset: match.index + match[0].length,
                });
            }
        }
        return this.filterEntities(entities);
    }

    private filterEntities(entities: PiiEntity[]): PiiEntity[] {
        return entities
            .filter((entity) => {
                if (typeof entity.Score === "number" && entity.Score < this.minScore) {
                    return false;
                }
                if (this.piiTypes && !this.piiTypes.has(entity.Type)) {
                    return false;
                }
                return (
                    typeof entity.BeginOffset === "number" &&
                    typeof entity.EndOffset === "number" &&
                    entity.BeginOffset >= 0 &&
                    entity.EndOffset > entity.BeginOffset
                );
            })
            .sort((a, b) => a.BeginOffset - b.BeginOffset || b.EndOffset - a.EndOffset);
    }

    /**
     * Calls AWS Comprehend DetectPiiEntities API to identify PII spans in text.
     */
    async detectPiiEntities(text: string, languageCode?: string): Promise<PiiEntity[]> {
        if (!text) {
            return [];
        }

        if ((!this.accessKeyId || !this.secretAccessKey) && this.fallbackToRegex) {
            return this.detectPiiWithRegex(text);
        }

        if (!this.accessKeyId || !this.secretAccessKey) {
            throw new Error(
                "AWS credentials (accessKeyId and secretAccessKey) are required for AWS Comprehend DetectPiiEntities"
            );
        }

        const body = JSON.stringify({
            Text: text,
            LanguageCode: languageCode || this.languageCode,
        });
        const headers = this.signRequestHeaders(body);

        try {
            const response = await this.fetchFn(this.endpoint, {
                method: "POST",
                headers,
                body,
            });
            const rawText = await response.text();
            let parsed: any = {};
            if (rawText) {
                try {
                    parsed = JSON.parse(rawText);
                } catch {
                    parsed = { message: rawText };
                }
            }

            if (!response.ok) {
                const errMsg =
                    parsed?.message ||
                    parsed?.Message ||
                    parsed?.__type ||
                    `HTTP ${response.status}`;
                throw new Error(`AWS Comprehend DetectPiiEntities failed (${response.status}): ${errMsg}`);
            }

            const rawEntities: PiiEntity[] = Array.isArray(parsed?.Entities) ? parsed.Entities : [];
            return this.filterEntities(rawEntities);
        } catch (error) {
            if (this.fallbackToRegex) {
                return this.detectPiiWithRegex(text);
            }
            throw error;
        }
    }

    private formatReplacement(entity: PiiEntity, matchedText: string): string {
        if (this.replacer) {
            return this.replacer(entity, matchedText);
        }
        if (this.maskMode === "CHARACTER") {
            const char = this.maskCharacter || "*";
            return char.repeat(Math.max(1, matchedText.length));
        }
        return `[${entity.Type}]`;
    }

    /**
     * Redacts detected PII entities from the input text and returns detailed metadata.
     */
    async redactWithDetails(text: string): Promise<RedactionResult> {
        if (!text) {
            return { originalText: text, redactedText: text, entities: [] };
        }

        const entities = await this.detectPiiEntities(text);
        if (entities.length === 0) {
            return { originalText: text, redactedText: text, entities: [] };
        }

        // Deduplicate/merge overlapping spans before replacing right-to-left
        const nonOverlapping: PiiEntity[] = [];
        for (const entity of entities) {
            const prev = nonOverlapping[nonOverlapping.length - 1];
            if (!prev || entity.BeginOffset >= prev.EndOffset) {
                nonOverlapping.push(entity);
            } else if (entity.EndOffset > prev.EndOffset && entity.Score > prev.Score) {
                nonOverlapping[nonOverlapping.length - 1] = entity;
            }
        }

        let redactedText = text;
        for (let i = nonOverlapping.length - 1; i >= 0; i--) {
            const entity = nonOverlapping[i];
            const start = Math.max(0, Math.min(entity.BeginOffset, redactedText.length));
            const end = Math.max(start, Math.min(entity.EndOffset, redactedText.length));
            const matchedText = redactedText.slice(start, end);
            const replacement = this.formatReplacement(entity, matchedText);
            redactedText = redactedText.slice(0, start) + replacement + redactedText.slice(end);
        }

        return {
            originalText: text,
            redactedText,
            entities: nonOverlapping,
        };
    }

    /**
     * Redacts sensitive PII entities from a prompt string.
     */
    async redact(text: string): Promise<string> {
        const result = await this.redactWithDetails(text);
        return result.redactedText;
    }

    /**
     * Redacts PII in a chat options object (`prompt` string and/or `messages` array).
     */
    async redactChatOptions<T extends Record<string, any>>(chatOptions: T): Promise<T> {
        const cloned: Record<string, any> = { ...chatOptions };

        if (typeof cloned.prompt === "string") {
            cloned.prompt = await this.redact(cloned.prompt);
        }

        if (Array.isArray(cloned.messages)) {
            cloned.messages = await Promise.all(
                cloned.messages.map(async (msg: any) => {
                    if (msg && typeof msg.content === "string") {
                        return {
                            ...msg,
                            content: await this.redact(msg.content),
                        };
                    }
                    return msg;
                })
            );
        }

        return cloned as T;
    }

    /**
     * Creates an Observable that emits the redacted text for a given prompt.
     */
    observeRedaction(prompt: string): PiiObservable<RedactionResult> {
        return new PiiObservable<RedactionResult>(async (observer) => {
            try {
                const res = await this.redactWithDetails(prompt);
                observer.next(res);
                observer.complete();
            } catch (err) {
                observer.error(err);
            }
        });
    }

    /**
     * RxJS-compatible operator function that redacts string prompts or chat option payloads
     * inside an observable pipeline.
     */
    asOperator<T extends string | Record<string, any>>(): OperatorFn<T, T> {
        return (source: PiiObservable<T>) =>
            source.map(async (input: T) => {
                if (typeof input === "string") {
                    return (await this.redact(input)) as T;
                }
                if (input && typeof input === "object") {
                    return await this.redactChatOptions(input);
                }
                return input;
            });
    }

    /**
     * Chains this redactor with an EdgeChains Endpoint (`OpenAI`, `GeminiAI`, `LlamaAI`, `Palm2Endpoint`, etc.)
     * as an Observable pipeline that redacts `prompt` / `messages` before invoking `endpoint.chat(...)`.
     */
    chainWithEndpoint<TOptions extends Record<string, any>, TResponse = any>(
        endpoint: ChatLikeEndpoint<TOptions, TResponse>,
        chatOptions: TOptions
    ): PiiObservable<{ redactedOptions: TOptions; response: TResponse }> {
        return PiiObservable.of(chatOptions)
            .pipe(this.asOperator<TOptions>())
            .map(async (redactedOptions) => {
                const response = await endpoint.chat(redactedOptions);
                return { redactedOptions, response };
            });
    }

    /**
     * Wraps an Endpoint instance (`OpenAI`, `GeminiAI`, `LlamaAI`, etc.) so every `.chat()` call
     * automatically redacts PII in prompts/messages before forwarding to the underlying endpoint.
     */
    wrapEndpoint<TEndpoint extends ChatLikeEndpoint<any, any>>(endpoint: TEndpoint): TEndpoint {
        const redactor = this;
        return new Proxy(endpoint, {
            get(target, prop, receiver) {
                if (prop === "chat") {
                    return async (chatOptions: Record<string, any>) => {
                        const redactedOptions = await redactor.redactChatOptions(chatOptions);
                        return target.chat(redactedOptions);
                    };
                }
                const value = Reflect.get(target, prop, receiver);
                return typeof value === "function" ? value.bind(target) : value;
            },
        });
    }
}

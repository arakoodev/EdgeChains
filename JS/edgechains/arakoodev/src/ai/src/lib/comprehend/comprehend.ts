import axios from "axios";
import crypto from "crypto";

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
    | "LICENSE_PLATE"
    | "VEHICLE_IDENTIFICATION_NUMBER"
    | "UK_NATIONAL_INSURANCE_NUMBER"
    | "CA_SOCIAL_INSURANCE_NUMBER"
    | "US_INDIVIDUAL_TAX_IDENTIFICATION_NUMBER"
    | "INTERNATIONAL_BANK_ACCOUNT_NUMBER"
    | "SWIFT_CODE"
    | "UK_NATIONAL_HEALTH_SERVICE_NUMBER"
    | "CA_HEALTH_NUMBER"
    | "UK_UNIQUE_TAXPAYER_REFERENCE_NUMBER"
    | "IN_PERMANENT_ACCOUNT_NUMBER"
    | "IN_NREGA"
    | "IN_AADHAAR"
    | "IN_VOTER_NUMBER"
    | (string & {});

export interface PiiEntity {
    Type: PiiEntityType;
    Score?: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface PiiEntityLabel {
    Name: PiiEntityType;
    Score?: number;
}

export type RedactionMaskMode = "MASK" | "REPLACE_WITH_PII_ENTITY_TYPE";

export interface ComprehendClientLike {
    send?: (command: any) => Promise<any>;
    detectPiiEntities?: (params: {
        Text: string;
        LanguageCode: string;
    }) => Promise<{ Entities?: PiiEntity[] }>;
    containsPiiEntities?: (params: {
        Text: string;
        LanguageCode: string;
    }) => Promise<{ Labels?: PiiEntityLabel[] }>;
}

export interface AwsComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    maskMode?: RedactionMaskMode;
    maskCharacter?: string;
    preserveMaskLength?: boolean;
    piiEntityTypes?: PiiEntityType[] | "ALL";
    confidenceThreshold?: number;
    endpointUrl?: string;
    maxChunkBytes?: number;
    client?: ComprehendClientLike;
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

export interface Subscription {
    unsubscribe(): void;
    readonly closed: boolean;
}

export type OperatorFunction<T, R> = (source: RedactionObservable<T>) => RedactionObservable<R>;

const MAX_COMPREHEND_UTF8_BYTES = 5000;

/**
 * Lightweight, RxJS/TC39-compatible Observable implementation for chaining
 * prompt redaction and EdgeChains AI Endpoint calls.
 */
export class RedactionObservable<T> {
    private _subscribe: (observer: Required<Observer<T>>) => (() => void) | void;

    constructor(subscribe: (observer: Required<Observer<T>>) => (() => void) | void) {
        this._subscribe = subscribe;
    }

    static of<T>(...items: T[]): RedactionObservable<T> {
        return new RedactionObservable<T>((observer) => {
            for (const item of items) {
                observer.next(item);
            }
            observer.complete();
        });
    }

    static from<T>(input: Promise<T> | Iterable<T> | RedactionObservable<T>): RedactionObservable<T> {
        if (input instanceof RedactionObservable) {
            return input;
        }
        if (input && typeof (input as Promise<T>).then === "function") {
            return new RedactionObservable<T>((observer) => {
                let cancelled = false;
                (input as Promise<T>)
                    .then((val) => {
                        if (!cancelled) {
                            observer.next(val);
                            observer.complete();
                        }
                    })
                    .catch((err) => {
                        if (!cancelled) {
                            observer.error(err);
                        }
                    });
                return () => {
                    cancelled = true;
                };
            });
        }
        return new RedactionObservable<T>((observer) => {
            try {
                for (const item of input as Iterable<T>) {
                    observer.next(item);
                }
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
    ): Subscription {
        let closed = false;
        let teardown: (() => void) | void;

        const rawObserver: Observer<T> =
            typeof observerOrNext === "function"
                ? { next: observerOrNext, error, complete }
                : observerOrNext || {};

        const safeObserver: Required<Observer<T>> = {
            next: (value: T) => {
                if (!closed && rawObserver.next) {
                    try {
                        rawObserver.next(value);
                    } catch (err) {
                        safeObserver.error(err);
                    }
                }
            },
            error: (err: unknown) => {
                if (!closed) {
                    closed = true;
                    try {
                        if (rawObserver.error) {
                            rawObserver.error(err);
                        }
                    } finally {
                        if (typeof teardown === "function") {
                            teardown();
                        }
                    }
                }
            },
            complete: () => {
                if (!closed) {
                    closed = true;
                    try {
                        if (rawObserver.complete) {
                            rawObserver.complete();
                        }
                    } finally {
                        if (typeof teardown === "function") {
                            teardown();
                        }
                    }
                }
            },
        };

        try {
            teardown = this._subscribe(safeObserver);
        } catch (err) {
            safeObserver.error(err);
        }

        return {
            unsubscribe: () => {
                if (!closed) {
                    closed = true;
                    if (typeof teardown === "function") {
                        teardown();
                    }
                }
            },
            get closed() {
                return closed;
            },
        };
    }

    pipe(): RedactionObservable<T>;
    pipe<A>(op1: OperatorFunction<T, A>): RedactionObservable<A>;
    pipe<A, B>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): RedactionObservable<B>;
    pipe<A, B, C>(
        op1: OperatorFunction<T, A>,
        op2: OperatorFunction<A, B>,
        op3: OperatorFunction<B, C>
    ): RedactionObservable<C>;
    pipe<A, B, C, D>(
        op1: OperatorFunction<T, A>,
        op2: OperatorFunction<A, B>,
        op3: OperatorFunction<B, C>,
        op4: OperatorFunction<C, D>
    ): RedactionObservable<D>;
    pipe(...operations: OperatorFunction<any, any>[]): RedactionObservable<any> {
        return operations.reduce((prev, fn) => fn(prev), this as RedactionObservable<any>);
    }

    map<R>(project: (value: T) => R): RedactionObservable<R> {
        return new RedactionObservable<R>((observer) => {
            const sub = this.subscribe({
                next: (val) => {
                    try {
                        observer.next(project(val));
                    } catch (err) {
                        observer.error(err);
                    }
                },
                error: (err) => observer.error(err),
                complete: () => observer.complete(),
            });
            return () => sub.unsubscribe();
        });
    }

    flatMap<R>(
        project: (value: T) => Promise<R> | RedactionObservable<R> | R
    ): RedactionObservable<R> {
        return new RedactionObservable<R>((observer) => {
            let active = 0;
            let sourceCompleted = false;
            let innerSubs: Subscription[] = [];

            const checkComplete = () => {
                if (sourceCompleted && active === 0) {
                    observer.complete();
                }
            };

            const outerSub = this.subscribe({
                next: (val) => {
                    active++;
                    try {
                        const result = project(val);
                        const innerObs =
                            result instanceof RedactionObservable ||
                            (result && typeof (result as Promise<R>).then === "function")
                                ? RedactionObservable.from(result as Promise<R> | RedactionObservable<R>)
                                : RedactionObservable.of(result as R);

                        const innerSub = innerObs.subscribe({
                            next: (innerVal) => observer.next(innerVal),
                            error: (err) => observer.error(err),
                            complete: () => {
                                active--;
                                checkComplete();
                            },
                        });
                        innerSubs.push(innerSub);
                    } catch (err) {
                        observer.error(err);
                    }
                },
                error: (err) => observer.error(err),
                complete: () => {
                    sourceCompleted = true;
                    checkComplete();
                },
            });

            return () => {
                outerSub.unsubscribe();
                for (const sub of innerSubs) {
                    sub.unsubscribe();
                }
            };
        });
    }

    mergeMap<R>(
        project: (value: T) => Promise<R> | RedactionObservable<R> | R
    ): RedactionObservable<R> {
        return this.flatMap(project);
    }

    filter(predicate: (value: T) => boolean): RedactionObservable<T> {
        return new RedactionObservable<T>((observer) => {
            const sub = this.subscribe({
                next: (val) => {
                    try {
                        if (predicate(val)) {
                            observer.next(val);
                        }
                    } catch (err) {
                        observer.error(err);
                    }
                },
                error: (err) => observer.error(err),
                complete: () => observer.complete(),
            });
            return () => sub.unsubscribe();
        });
    }

    tap(sideEffect: (value: T) => void): RedactionObservable<T> {
        return this.map((val) => {
            sideEffect(val);
            return val;
        });
    }

    catchError<R>(handler: (err: unknown) => Promise<R> | RedactionObservable<R> | R): RedactionObservable<T | R> {
        return new RedactionObservable<T | R>((observer) => {
            let fallbackSub: Subscription | undefined;
            const sub = this.subscribe({
                next: (val) => observer.next(val),
                error: (err) => {
                    try {
                        const result = handler(err);
                        const obs =
                            result instanceof RedactionObservable ||
                            (result && typeof (result as Promise<R>).then === "function")
                                ? RedactionObservable.from(result as Promise<R> | RedactionObservable<R>)
                                : RedactionObservable.of(result as R);
                        fallbackSub = obs.subscribe(observer);
                    } catch (innerErr) {
                        observer.error(innerErr);
                    }
                },
                complete: () => observer.complete(),
            });
            return () => {
                sub.unsubscribe();
                if (fallbackSub) {
                    fallbackSub.unsubscribe();
                }
            };
        });
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
                    resolve(hasValue ? lastValue! : (undefined as unknown as T));
                },
            });
        });
    }
}

export function mapOperator<T, R>(project: (value: T) => R): OperatorFunction<T, R> {
    return (source) => source.map(project);
}

export function flatMapOperator<T, R>(
    project: (value: T) => Promise<R> | RedactionObservable<R> | R
): OperatorFunction<T, R> {
    return (source) => source.flatMap(project);
}

export function tapOperator<T>(sideEffect: (value: T) => void): OperatorFunction<T, T> {
    return (source) => source.tap(sideEffect);
}

export function redactPromptOperator<T extends string | Record<string, any>>(
    redactor: AwsComprehendRedactor,
    overrides?: Partial<AwsComprehendOptions>
): OperatorFunction<T, T> {
    return (source) =>
        source.flatMap(async (input) => {
            if (typeof input === "string") {
                return (await redactor.redact(input, overrides)) as unknown as T;
            }
            return (await redactor.redactChatOptions(input as Record<string, any>, overrides)) as unknown as T;
        });
}

export function chainEndpointOperator<TInput extends Record<string, any>, TOutput = any>(
    endpoint: Record<string, any>,
    method: "chat" | "streamedChat" | "chatWithFunction" | "zodSchemaResponse" = "chat"
): OperatorFunction<TInput, TOutput> {
    return (source) =>
        source.flatMap(async (options) => {
            const fn = endpoint[method];
            if (typeof fn !== "function") {
                throw new Error(`Endpoint does not implement method "${method}"`);
            }
            return await fn.call(endpoint, options);
        });
}

function sha256Hex(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

export function signAwsComprehendRequest(params: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    host: string;
    amzTarget: string;
    body: string;
    amzDate?: string;
}): Record<string, string> {
    const now = new Date();
    const amzDate =
        params.amzDate ||
        now
            .toISOString()
            .replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const service = "comprehend";
    const contentType = "application/x-amz-json-1.1";
    const payloadHash = sha256Hex(params.body);

    const headersMap: Record<string, string> = {
        "content-type": contentType,
        host: params.host,
        "x-amz-date": amzDate,
        "x-amz-target": params.amzTarget,
    };

    if (params.sessionToken) {
        headersMap["x-amz-security-token"] = params.sessionToken;
    }

    const sortedHeaderKeys = Object.keys(headersMap).sort();
    const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headersMap[k]}\n`).join("");
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
    const credentialScope = `${dateStamp}/${params.region}/${service}/aws4_request`;
    const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
    ].join("\n");

    const kDate = hmacSha256(`AWS4${params.secretAccessKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, params.region);
    const kService = hmacSha256(kRegion, service);
    const kSigning = hmacSha256(kService, "aws4_request");
    const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

    const authorizationHeader = `${algorithm} Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const requestHeaders: Record<string, string> = {
        "Content-Type": contentType,
        Host: params.host,
        "X-Amz-Date": amzDate,
        "X-Amz-Target": params.amzTarget,
        Authorization: authorizationHeader,
    };

    if (params.sessionToken) {
        requestHeaders["X-Amz-Security-Token"] = params.sessionToken;
    }

    return requestHeaders;
}

export function splitTextByUtf8ByteLimit(
    text: string,
    maxBytes: number = MAX_COMPREHEND_UTF8_BYTES
): Array<{ chunk: string; charStartOffset: number }> {
    if (!text) {
        return [];
    }
    if (Buffer.byteLength(text, "utf8") <= maxBytes) {
        return [{ chunk: text, charStartOffset: 0 }];
    }

    const chunks: Array<{ chunk: string; charStartOffset: number }> = [];
    let currentStart = 0;

    while (currentStart < text.length) {
        let currentEnd = currentStart;
        let currentBytes = 0;
        let lastBreakPoint = -1;

        while (currentEnd < text.length) {
            const codePoint = text.codePointAt(currentEnd)!;
            const charLen = codePoint > 0xffff ? 2 : 1;
            const charStr = text.slice(currentEnd, currentEnd + charLen);
            const charBytes = Buffer.byteLength(charStr, "utf8");

            if (currentBytes + charBytes > maxBytes) {
                break;
            }

            currentBytes += charBytes;
            currentEnd += charLen;

            if (/\s|[.,!?;:\n]/.test(charStr)) {
                lastBreakPoint = currentEnd;
            }
        }

        if (currentEnd < text.length && lastBreakPoint > currentStart) {
            currentEnd = lastBreakPoint;
        }

        chunks.push({
            chunk: text.slice(currentStart, currentEnd),
            charStartOffset: currentStart,
        });
        currentStart = currentEnd;
    }

    return chunks;
}

/**
 * AWS Comprehend PII detection and prompt redaction utility that chains as an
 * Observable with EdgeChains Endpoint classes (`OpenAI`, `GeminiAI`, `LlamaAI`).
 */
export class AwsComprehendRedactor {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    languageCode: string;
    maskMode: RedactionMaskMode;
    maskCharacter: string;
    preserveMaskLength: boolean;
    piiEntityTypes: PiiEntityType[] | "ALL";
    confidenceThreshold: number;
    endpointUrl: string;
    maxChunkBytes: number;
    client?: ComprehendClientLike;

    constructor(options: AwsComprehendOptions = {}) {
        this.region =
            options.region ||
            process.env.AWS_REGION ||
            process.env.AWS_DEFAULT_REGION ||
            "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN || "";
        this.languageCode = options.languageCode || "en";
        this.maskMode = options.maskMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || "*";
        this.preserveMaskLength = options.preserveMaskLength ?? true;
        this.piiEntityTypes = options.piiEntityTypes || "ALL";
        this.confidenceThreshold = options.confidenceThreshold ?? 0.5;
        this.endpointUrl =
            options.endpointUrl || `https://comprehend.${this.region}.amazonaws.com/`;
        this.maxChunkBytes = options.maxChunkBytes || MAX_COMPREHEND_UTF8_BYTES;
        this.client = options.client;
    }

    private async callComprehendChunk(
        text: string,
        languageCode: string,
        operation: "DetectPiiEntities" | "ContainsPiiEntities"
    ): Promise<any> {
        if (!text || text.trim().length === 0) {
            return operation === "DetectPiiEntities" ? { Entities: [] } : { Labels: [] };
        }

        if (this.client) {
            if (operation === "DetectPiiEntities" && typeof this.client.detectPiiEntities === "function") {
                return await this.client.detectPiiEntities({ Text: text, LanguageCode: languageCode });
            }
            if (operation === "ContainsPiiEntities" && typeof this.client.containsPiiEntities === "function") {
                return await this.client.containsPiiEntities({ Text: text, LanguageCode: languageCode });
            }
            if (typeof this.client.send === "function") {
                return await this.client.send({
                    input: { Text: text, LanguageCode: languageCode },
                    operation,
                });
            }
        }

        if (!this.accessKeyId || !this.secretAccessKey) {
            throw new Error(
                "AWS credentials are missing. Provide accessKeyId and secretAccessKey or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
            );
        }

        const parsedUrl = new URL(this.endpointUrl);
        const body = JSON.stringify({
            Text: text,
            LanguageCode: languageCode,
        });
        const headers = signAwsComprehendRequest({
            region: this.region,
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.secretAccessKey,
            sessionToken: this.sessionToken || undefined,
            host: parsedUrl.host,
            amzTarget: `Comprehend_20171127.${operation}`,
            body,
        });

        const response = await axios.post(this.endpointUrl, body, { headers });
        return response.data;
    }

    async detectPiiEntities(text: string, languageCode?: string): Promise<PiiEntity[]> {
        if (!text || text.trim().length === 0) {
            return [];
        }
        const lang = languageCode || this.languageCode;
        const chunks = splitTextByUtf8ByteLimit(text, this.maxChunkBytes);
        const allEntities: PiiEntity[] = [];

        for (const { chunk, charStartOffset } of chunks) {
            if (!chunk || chunk.trim().length === 0) {
                continue;
            }
            const data = await this.callComprehendChunk(chunk, lang, "DetectPiiEntities");
            const entities: PiiEntity[] = Array.isArray(data?.Entities) ? data.Entities : [];
            for (const entity of entities) {
                allEntities.push({
                    Type: entity.Type,
                    Score: entity.Score,
                    BeginOffset: entity.BeginOffset + charStartOffset,
                    EndOffset: entity.EndOffset + charStartOffset,
                });
            }
        }

        return allEntities;
    }

    async containsPiiEntities(text: string, languageCode?: string): Promise<PiiEntityLabel[]> {
        if (!text || text.trim().length === 0) {
            return [];
        }
        const lang = languageCode || this.languageCode;
        const data = await this.callComprehendChunk(text, lang, "ContainsPiiEntities");
        return Array.isArray(data?.Labels) ? data.Labels : [];
    }

    private shouldRedactEntity(entity: PiiEntity, overrides?: Partial<AwsComprehendOptions>): boolean {
        const threshold = overrides?.confidenceThreshold ?? this.confidenceThreshold;
        if (typeof entity.Score === "number" && entity.Score < threshold) {
            return false;
        }
        const allowedTypes = overrides?.piiEntityTypes ?? this.piiEntityTypes;
        if (allowedTypes === "ALL" || (Array.isArray(allowedTypes) && allowedTypes.includes("ALL"))) {
            return true;
        }
        return Array.isArray(allowedTypes) && allowedTypes.includes(entity.Type);
    }

    private formatReplacement(
        entity: PiiEntity,
        originalSpanLength: number,
        overrides?: Partial<AwsComprehendOptions>
    ): string {
        const mode = overrides?.maskMode ?? this.maskMode;
        if (mode === "MASK") {
            const maskChar = (overrides?.maskCharacter ?? this.maskCharacter) || "*";
            const preserveLen = overrides?.preserveMaskLength ?? this.preserveMaskLength;
            const repeatCount = preserveLen ? Math.max(1, originalSpanLength) : 5;
            return maskChar.repeat(repeatCount);
        }
        return `[${entity.Type}]`;
    }

    async redactText(
        text: string,
        overrides?: Partial<AwsComprehendOptions>
    ): Promise<RedactionResult> {
        if (!text) {
            return { originalText: text, redactedText: text, entities: [] };
        }

        const detected = await this.detectPiiEntities(text, overrides?.languageCode);
        const filtered = detected
            .filter((entity) => this.shouldRedactEntity(entity, overrides))
            .map((entity) => ({
                ...entity,
                BeginOffset: Math.max(0, Math.min(text.length, entity.BeginOffset)),
                EndOffset: Math.max(0, Math.min(text.length, entity.EndOffset)),
            }))
            .filter((entity) => entity.EndOffset > entity.BeginOffset)
            .sort((a, b) => a.BeginOffset - b.BeginOffset || b.EndOffset - a.EndOffset);

        // Deduplicate/resolve overlapping spans by keeping the earliest/longest span
        const nonOverlapping: PiiEntity[] = [];
        for (const entity of filtered) {
            const prev = nonOverlapping[nonOverlapping.length - 1];
            if (!prev || entity.BeginOffset >= prev.EndOffset) {
                nonOverlapping.push(entity);
            } else if (entity.EndOffset > prev.EndOffset && (entity.Score ?? 1) > (prev.Score ?? 1)) {
                nonOverlapping[nonOverlapping.length - 1] = entity;
            }
        }

        let redactedText = text;
        for (let i = nonOverlapping.length - 1; i >= 0; i--) {
            const entity = nonOverlapping[i];
            const spanLength = entity.EndOffset - entity.BeginOffset;
            const replacement = this.formatReplacement(entity, spanLength, overrides);
            redactedText =
                redactedText.slice(0, entity.BeginOffset) +
                replacement +
                redactedText.slice(entity.EndOffset);
        }

        return {
            originalText: text,
            redactedText,
            entities: nonOverlapping,
        };
    }

    async redact(text: string, overrides?: Partial<AwsComprehendOptions>): Promise<string> {
        const result = await this.redactText(text, overrides);
        return result.redactedText;
    }

    async redactMessages<T extends { role: string; content: string; name?: string }>(
        messages: T[],
        overrides?: Partial<AwsComprehendOptions>
    ): Promise<T[]> {
        if (!Array.isArray(messages)) {
            return messages;
        }
        const redactedMessages: T[] = [];
        for (const msg of messages) {
            if (msg && typeof msg.content === "string") {
                const redactedContent = await this.redact(msg.content, overrides);
                redactedMessages.push({
                    ...msg,
                    content: redactedContent,
                });
            } else {
                redactedMessages.push(msg);
            }
        }
        return redactedMessages;
    }

    async redactChatOptions<T extends Record<string, any>>(
        chatOptions: T,
        overrides?: Partial<AwsComprehendOptions>
    ): Promise<T> {
        if (!chatOptions || typeof chatOptions !== "object") {
            return chatOptions;
        }
        const cloned: Record<string, any> = { ...chatOptions };

        if (typeof cloned.prompt === "string") {
            cloned.prompt = await this.redact(cloned.prompt, overrides);
        }

        if (Array.isArray(cloned.messages)) {
            cloned.messages = await this.redactMessages(cloned.messages, overrides);
        }

        if (Array.isArray(cloned.input)) {
            const redactedInputs: string[] = [];
            for (const item of cloned.input) {
                redactedInputs.push(
                    typeof item === "string" ? await this.redact(item, overrides) : item
                );
            }
            cloned.input = redactedInputs;
        }

        return cloned as T;
    }

    observeRedact(
        text: string,
        overrides?: Partial<AwsComprehendOptions>
    ): RedactionObservable<RedactionResult> {
        return new RedactionObservable<RedactionResult>((observer) => {
            let cancelled = false;
            this.redactText(text, overrides)
                .then((res) => {
                    if (!cancelled) {
                        observer.next(res);
                        observer.complete();
                    }
                })
                .catch((err) => {
                    if (!cancelled) {
                        observer.error(err);
                    }
                });
            return () => {
                cancelled = true;
            };
        });
    }

    observeRedactChatOptions<T extends Record<string, any>>(
        chatOptions: T,
        overrides?: Partial<AwsComprehendOptions>
    ): RedactionObservable<T> {
        return new RedactionObservable<T>((observer) => {
            let cancelled = false;
            this.redactChatOptions(chatOptions, overrides)
                .then((res) => {
                    if (!cancelled) {
                        observer.next(res);
                        observer.complete();
                    }
                })
                .catch((err) => {
                    if (!cancelled) {
                        observer.error(err);
                    }
                });
            return () => {
                cancelled = true;
            };
        });
    }

    chain<TEndpoint extends Record<string, any>>(
        endpoint: TEndpoint
    ): RedactedEndpointChain<TEndpoint> {
        return new RedactedEndpointChain<TEndpoint>(this, endpoint);
    }
}

/**
 * Chained Observable wrapper that redacts sensitive PII in prompts/messages
 * using `AwsComprehendRedactor` before forwarding requests to an EdgeChains
 * Endpoint (`OpenAI`, `GeminiAI`, `LlamaAI`, etc.).
 */
export class RedactedEndpointChain<TEndpoint extends Record<string, any>> {
    readonly redactor: AwsComprehendRedactor;
    readonly endpoint: TEndpoint;
    private readonly operators: OperatorFunction<any, any>[];

    constructor(
        redactor: AwsComprehendRedactor,
        endpoint: TEndpoint,
        operators: OperatorFunction<any, any>[] = []
    ) {
        this.redactor = redactor;
        this.endpoint = endpoint;
        this.operators = operators;
    }

    pipe(...operators: OperatorFunction<any, any>[]): RedactedEndpointChain<TEndpoint> {
        return new RedactedEndpointChain<TEndpoint>(this.redactor, this.endpoint, [
            ...this.operators,
            ...operators,
        ]);
    }

    private buildPipeline<TInput extends Record<string, any>, TOutput = any>(
        chatOptions: TInput,
        methodName: string,
        overrides?: Partial<AwsComprehendOptions>
    ): RedactionObservable<TOutput> {
        let stream: RedactionObservable<any> = this.redactor.observeRedactChatOptions(
            chatOptions,
            overrides
        );
        for (const op of this.operators) {
            stream = op(stream);
        }
        return stream.flatMap(async (redactedOptions) => {
            const fn = this.endpoint[methodName];
            if (typeof fn !== "function") {
                throw new Error(`Endpoint does not support method "${methodName}"`);
            }
            return await fn.call(this.endpoint, redactedOptions);
        });
    }

    observeChat<TInput extends Record<string, any>, TOutput = any>(
        chatOptions: TInput,
        overrides?: Partial<AwsComprehendOptions>
    ): RedactionObservable<TOutput> {
        return this.buildPipeline<TInput, TOutput>(chatOptions, "chat", overrides);
    }

    observeStreamedChat<TInput extends Record<string, any>, TOutput = any>(
        chatOptions: TInput,
        overrides?: Partial<AwsComprehendOptions>
    ): RedactionObservable<TOutput> {
        return this.buildPipeline<TInput, TOutput>(chatOptions, "streamedChat", overrides);
    }

    observeChatWithFunction<TInput extends Record<string, any>, TOutput = any>(
        chatOptions: TInput,
        overrides?: Partial<AwsComprehendOptions>
    ): RedactionObservable<TOutput> {
        return this.buildPipeline<TInput, TOutput>(chatOptions, "chatWithFunction", overrides);
    }

    observeZodSchemaResponse<TInput extends Record<string, any>, TOutput = any>(
        chatOptions: TInput,
        overrides?: Partial<AwsComprehendOptions>
    ): RedactionObservable<TOutput> {
        return this.buildPipeline<TInput, TOutput>(chatOptions, "zodSchemaResponse", overrides);
    }

    observeGenerateEmbeddings<TInput extends { input: string[]; model: string }, TOutput = any>(
        options: TInput,
        overrides?: Partial<AwsComprehendOptions>
    ): RedactionObservable<TOutput> {
        return this.buildPipeline<TInput, TOutput>(options, "generateEmbeddings", overrides);
    }

    async chat<TInput extends Record<string, any>, TOutput = any>(
        chatOptions: TInput,
        overrides?: Partial<AwsComprehendOptions>
    ): Promise<TOutput> {
        return await this.observeChat<TInput, TOutput>(chatOptions, overrides).toPromise();
    }

    async streamedChat<TInput extends Record<string, any>, TOutput = any>(
        chatOptions: TInput,
        overrides?: Partial<AwsComprehendOptions>
    ): Promise<TOutput> {
        return await this.observeStreamedChat<TInput, TOutput>(chatOptions, overrides).toPromise();
    }

    async chatWithFunction<TInput extends Record<string, any>, TOutput = any>(
        chatOptions: TInput,
        overrides?: Partial<AwsComprehendOptions>
    ): Promise<TOutput> {
        return await this.observeChatWithFunction<TInput, TOutput>(chatOptions, overrides).toPromise();
    }

    async zodSchemaResponse<TInput extends Record<string, any>, TOutput = any>(
        chatOptions: TInput,
        overrides?: Partial<AwsComprehendOptions>
    ): Promise<TOutput> {
        return await this.observeZodSchemaResponse<TInput, TOutput>(chatOptions, overrides).toPromise();
    }

    async generateEmbeddings<TInput extends { input: string[]; model: string }, TOutput = any>(
        options: TInput,
        overrides?: Partial<AwsComprehendOptions>
    ): Promise<TOutput> {
        return await this.observeGenerateEmbeddings<TInput, TOutput>(options, overrides).toPromise();
    }
}

export { AwsComprehendRedactor as AwsComprehend, AwsComprehendRedactor as ComprehendRedactor };

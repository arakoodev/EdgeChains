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
    | "UK_UNIQUE_TAXPAYER_REFERENCE_NUMBER"
    | "IN_PERMANENT_ACCOUNT_NUMBER"
    | "IN_NREGA"
    | "INTERNATIONAL_BANK_ACCOUNT_NUMBER"
    | "SWIFT_CODE"
    | "UK_NATIONAL_HEALTH_SERVICE_NUMBER"
    | "CA_HEALTH_NUMBER"
    | "IN_AADHAAR"
    | "IN_VOTER_NUMBER";

export type PiiMaskMode = "MASK" | "REPLACE_WITH_PII_ENTITY_TYPE" | "CHARACTER_MASK";

export interface PiiEntity {
    Score: number;
    Type: PiiEntityType | string;
    BeginOffset: number;
    EndOffset: number;
}

export interface PiiLabel {
    Name: PiiEntityType | string;
    Score: number;
}

export interface CustomComprehendClient {
    detectPiiEntities(params: {
        Text: string;
        LanguageCode: string;
    }): Promise<{ Entities?: PiiEntity[] }>;
    containsPiiEntities?(params: {
        Text: string;
        LanguageCode: string;
    }): Promise<{ Labels?: PiiLabel[] }>;
}

export interface AWSComprehendOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
    languageCode?: string;
    minConfidence?: number;
    piiEntityTypes?: PiiEntityType[];
    maskMode?: PiiMaskMode;
    maskCharacter?: string;
    maskText?: string;
    maxChunkBytes?: number;
    endpointUrl?: string;
    comprehendClient?: CustomComprehendClient;
}

export interface PiiRedactionOptions {
    languageCode?: string;
    minConfidence?: number;
    piiEntityTypes?: PiiEntityType[];
    maskMode?: PiiMaskMode;
    maskCharacter?: string;
    maskText?: string;
}

export interface PiiRedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
    redactedCount: number;
}

export interface EndpointMessage {
    role: string;
    content: string;
    name?: string;
}

export interface EndpointChatInput {
    prompt?: string;
    messages?: EndpointMessage[];
    [key: string]: any;
}

export interface ChainableEndpoint<TResponse = any> {
    chat(options: any): Promise<TResponse>;
    streamedChat?(options: any): Promise<TResponse>;
    chatWithFunction?(options: any): Promise<TResponse>;
    zodSchemaResponse?(options: any): Promise<TResponse>;
}

export interface ChainedRedactionResponse<TInput extends EndpointChatInput, TOutput> {
    originalInput: TInput;
    redactedInput: TInput;
    entities: PiiEntity[];
    response: TOutput;
}

export interface RedactedEndpoint<TEndpoint extends ChainableEndpoint<any>> {
    endpoint: TEndpoint;
    redactor: AWSComprehend;
    chat: (chatOptions: EndpointChatInput, options?: PiiRedactionOptions) => Promise<any>;
    chatObservable: (
        chatOptions: EndpointChatInput,
        options?: PiiRedactionOptions
    ) => PiiObservable<ChainedRedactionResponse<EndpointChatInput, any>>;
    streamedChat: (chatOptions: EndpointChatInput, options?: PiiRedactionOptions) => Promise<any>;
    chatWithFunction: (
        chatOptions: EndpointChatInput,
        options?: PiiRedactionOptions
    ) => Promise<any>;
    zodSchemaResponse: (
        chatOptions: EndpointChatInput,
        options?: PiiRedactionOptions
    ) => Promise<any>;
}

export interface PiiObserver<T> {
    next?: (value: T) => void;
    error?: (err: any) => void;
    complete?: () => void;
}

export interface PiiSubscription {
    unsubscribe(): void;
    readonly closed: boolean;
}

export type OperatorFunction<T, R> = (source: PiiObservable<T>) => PiiObservable<R>;

/**
 * Lightweight, zero-dependency Observable implementation for chaining
 * PII redaction streams with EdgeChains LLM Endpoint classes.
 */
export class PiiObservable<T> {
    private subscriberFn: (
        observer: Required<PiiObserver<T>>
    ) => void | (() => void) | { unsubscribe: () => void };

    constructor(
        subscriberFn: (
            observer: Required<PiiObserver<T>>
        ) => void | (() => void) | { unsubscribe: () => void }
    ) {
        this.subscriberFn = subscriberFn;
    }

    static of<U>(...values: U[]): PiiObservable<U> {
        return new PiiObservable<U>((observer) => {
            for (const val of values) {
                observer.next(val);
            }
            observer.complete();
        });
    }

    static from<U>(input: Iterable<U> | Promise<U> | PiiObservable<U>): PiiObservable<U> {
        if (input instanceof PiiObservable) {
            return input;
        }
        if (input && typeof (input as Promise<U>).then === "function") {
            return PiiObservable.fromPromise(input as Promise<U>);
        }
        return new PiiObservable<U>((observer) => {
            try {
                for (const item of input as Iterable<U>) {
                    observer.next(item);
                }
                observer.complete();
            } catch (err) {
                observer.error(err);
            }
        });
    }

    static fromPromise<U>(promise: Promise<U>): PiiObservable<U> {
        return new PiiObservable<U>((observer) => {
            let cancelled = false;
            promise
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

    subscribe(
        observerOrNext?: PiiObserver<T> | ((value: T) => void),
        error?: (err: any) => void,
        complete?: () => void
    ): PiiSubscription {
        let closed = false;
        const rawObserver: PiiObserver<T> =
            typeof observerOrNext === "function"
                ? { next: observerOrNext, error, complete }
                : observerOrNext || {};

        let teardown: void | (() => void) | { unsubscribe: () => void };

        const safeObserver: Required<PiiObserver<T>> = {
            next: (val: T) => {
                if (!closed && rawObserver.next) {
                    rawObserver.next(val);
                }
            },
            error: (err: any) => {
                if (!closed) {
                    closed = true;
                    if (rawObserver.error) {
                        rawObserver.error(err);
                    }
                }
            },
            complete: () => {
                if (!closed) {
                    closed = true;
                    if (rawObserver.complete) {
                        rawObserver.complete();
                    }
                }
            },
        };

        try {
            teardown = this.subscriberFn(safeObserver);
        } catch (err) {
            safeObserver.error(err);
        }

        return {
            get closed() {
                return closed;
            },
            unsubscribe() {
                if (!closed) {
                    closed = true;
                    if (typeof teardown === "function") {
                        teardown();
                    } else if (teardown && typeof teardown.unsubscribe === "function") {
                        teardown.unsubscribe();
                    }
                }
            },
        };
    }

    map<R>(project: (value: T) => R): PiiObservable<R> {
        return new PiiObservable<R>((observer) => {
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

    filter(predicate: (value: T) => boolean): PiiObservable<T> {
        return new PiiObservable<T>((observer) => {
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

    flatMap<R>(project: (value: T) => PiiObservable<R> | Promise<R>): PiiObservable<R> {
        return new PiiObservable<R>((observer) => {
            let active = 0;
            let outerCompleted = false;
            const innerSubs: PiiSubscription[] = [];

            const outerSub = this.subscribe({
                next: (val) => {
                    active++;
                    try {
                        const result = project(val);
                        const innerObs =
                            result instanceof PiiObservable
                                ? result
                                : PiiObservable.fromPromise(result);
                        const innerSub = innerObs.subscribe({
                            next: (innerVal) => observer.next(innerVal),
                            error: (err) => observer.error(err),
                            complete: () => {
                                active--;
                                if (outerCompleted && active === 0) {
                                    observer.complete();
                                }
                            },
                        });
                        innerSubs.push(innerSub);
                    } catch (err) {
                        observer.error(err);
                    }
                },
                error: (err) => observer.error(err),
                complete: () => {
                    outerCompleted = true;
                    if (active === 0) {
                        observer.complete();
                    }
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

    mergeMap<R>(project: (value: T) => PiiObservable<R> | Promise<R>): PiiObservable<R> {
        return this.flatMap(project);
    }

    tap(sideEffect: (value: T) => void): PiiObservable<T> {
        return this.map((val) => {
            sideEffect(val);
            return val;
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
                next: (val) => {
                    lastVal = val;
                    hasVal = true;
                },
                error: (err) => reject(err),
                complete: () => {
                    resolve(hasVal ? lastVal : (undefined as unknown as T));
                },
            });
        });
    }
}

/**
 * AWS Comprehend PII Detection & Redaction Utility that can be chained as an Observable
 * with EdgeChains LLM Endpoint classes (OpenAI, GeminiAI, LlamaAI).
 */
export class AWSComprehend {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    region: string;
    languageCode: string;
    minConfidence: number;
    piiEntityTypes: PiiEntityType[];
    maskMode: PiiMaskMode;
    maskCharacter: string;
    maskText?: string;
    maxChunkBytes: number;
    endpointUrl: string;
    private comprehendClient?: CustomComprehendClient;

    constructor(options: AWSComprehendOptions = {}) {
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.languageCode = options.languageCode || "en";
        this.minConfidence = options.minConfidence ?? 0.5;
        this.piiEntityTypes = options.piiEntityTypes || ["ALL"];
        this.maskMode = options.maskMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || "*";
        this.maskText = options.maskText;
        this.maxChunkBytes = options.maxChunkBytes || 95000;
        this.endpointUrl =
            options.endpointUrl || `https://comprehend.${this.region}.amazonaws.com/`;
        this.comprehendClient = options.comprehendClient;
    }

    private sha256Hex(data: string): string {
        return crypto.createHash("sha256").update(data, "utf8").digest("hex");
    }

    private hmac(key: string | Buffer, data: string): Buffer {
        return crypto.createHmac("sha256", key).update(data, "utf8").digest();
    }

    private buildSigV4Headers(
        targetAction: string,
        payload: string,
        now: Date = new Date()
    ): Record<string, string> {
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const parsedUrl = new URL(this.endpointUrl);
        const host = parsedUrl.host;
        const canonicalUri = parsedUrl.pathname || "/";
        const contentType = "application/x-amz-json-1.1";
        const amzTarget = `Comprehend_20171127.${targetAction}`;
        const payloadHash = this.sha256Hex(payload);

        const canonicalHeadersMap: Record<string, string> = {
            "content-type": contentType,
            host,
            "x-amz-date": amzDate,
            "x-amz-target": amzTarget,
        };
        if (this.sessionToken) {
            canonicalHeadersMap["x-amz-security-token"] = this.sessionToken;
        }

        const sortedHeaderKeys = Object.keys(canonicalHeadersMap).sort();
        const canonicalHeaders = sortedHeaderKeys
            .map((key) => `${key}:${canonicalHeadersMap[key].trim()}\n`)
            .join("");
        const signedHeaders = sortedHeaderKeys.join(";");

        const canonicalRequest = [
            "POST",
            canonicalUri,
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
            this.sha256Hex(canonicalRequest),
        ].join("\n");

        const kDate = this.hmac(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = this.hmac(kDate, this.region);
        const kService = this.hmac(kRegion, "comprehend");
        const kSigning = this.hmac(kService, "aws4_request");
        const signature = crypto
            .createHmac("sha256", kSigning)
            .update(stringToSign, "utf8")
            .digest("hex");

        const authorizationHeader =
            `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": amzTarget,
            Authorization: authorizationHeader,
        };

        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }

        return headers;
    }

    private splitTextIntoChunks(text: string): Array<{ chunk: string; startOffset: number }> {
        if (Buffer.byteLength(text, "utf8") <= this.maxChunkBytes) {
            return [{ chunk: text, startOffset: 0 }];
        }

        const chunks: Array<{ chunk: string; startOffset: number }> = [];
        let cursor = 0;

        while (cursor < text.length) {
            let end = cursor + Math.min(text.length - cursor, this.maxChunkBytes);
            while (
                end > cursor &&
                Buffer.byteLength(text.slice(cursor, end), "utf8") > this.maxChunkBytes
            ) {
                end = Math.floor((cursor + end) / 2);
            }

            if (end < text.length) {
                const lastSpace = text.lastIndexOf(" ", end);
                if (lastSpace > cursor) {
                    end = lastSpace + 1;
                }
            }

            chunks.push({
                chunk: text.slice(cursor, end),
                startOffset: cursor,
            });
            cursor = end;
        }

        return chunks;
    }

    private async invokeComprehendChunk(
        targetAction: "DetectPiiEntities" | "ContainsPiiEntities",
        text: string,
        languageCode: string
    ): Promise<any> {
        if (this.comprehendClient) {
            if (targetAction === "DetectPiiEntities") {
                return this.comprehendClient.detectPiiEntities({
                    Text: text,
                    LanguageCode: languageCode,
                });
            }
            if (
                targetAction === "ContainsPiiEntities" &&
                this.comprehendClient.containsPiiEntities
            ) {
                return this.comprehendClient.containsPiiEntities({
                    Text: text,
                    LanguageCode: languageCode,
                });
            }
        }

        const payload = JSON.stringify({
            Text: text,
            LanguageCode: languageCode,
        });
        const headers = this.buildSigV4Headers(targetAction, payload);
        const response = await axios.post(this.endpointUrl, payload, { headers });
        return response.data;
    }

    /**
     * Calls AWS Comprehend DetectPiiEntities to identify PII entities with character offsets.
     */
    async detectPiiEntities(
        text: string,
        languageCode: string = this.languageCode
    ): Promise<PiiEntity[]> {
        if (!text) {
            return [];
        }

        const chunks = this.splitTextIntoChunks(text);
        const allEntities: PiiEntity[] = [];

        for (const { chunk, startOffset } of chunks) {
            const data = await this.invokeComprehendChunk("DetectPiiEntities", chunk, languageCode);
            const entities: PiiEntity[] = data?.Entities || [];
            for (const entity of entities) {
                allEntities.push({
                    Score: entity.Score,
                    Type: entity.Type,
                    BeginOffset: entity.BeginOffset + startOffset,
                    EndOffset: entity.EndOffset + startOffset,
                });
            }
        }

        return allEntities;
    }

    /**
     * Calls AWS Comprehend ContainsPiiEntities to classify whether text contains PII labels.
     */
    async containsPiiEntities(
        text: string,
        languageCode: string = this.languageCode
    ): Promise<PiiLabel[]> {
        if (!text) {
            return [];
        }

        const data = await this.invokeComprehendChunk("ContainsPiiEntities", text, languageCode);
        return data?.Labels || [];
    }

    /**
     * Redacts PII entities from a string based on AWS Comprehend detection results.
     */
    async redactPii(text: string, options: PiiRedactionOptions = {}): Promise<PiiRedactionResult> {
        if (!text) {
            return {
                originalText: text,
                redactedText: text,
                entities: [],
                redactedCount: 0,
            };
        }

        const languageCode = options.languageCode || this.languageCode;
        const minConfidence = options.minConfidence ?? this.minConfidence;
        const allowedTypes = options.piiEntityTypes || this.piiEntityTypes;
        const maskMode = options.maskMode || this.maskMode;
        const maskCharacter = options.maskCharacter || this.maskCharacter;
        const maskText = options.maskText ?? this.maskText;

        const detectedEntities = await this.detectPiiEntities(text, languageCode);

        const filteredEntities = detectedEntities.filter((entity) => {
            const meetsScore = entity.Score >= minConfidence;
            const meetsType =
                allowedTypes.includes("ALL") || allowedTypes.includes(entity.Type as PiiEntityType);
            return meetsScore && meetsType;
        });

        if (filteredEntities.length === 0) {
            return {
                originalText: text,
                redactedText: text,
                entities: [],
                redactedCount: 0,
            };
        }

        const sortedAsc = [...filteredEntities].sort(
            (a, b) => a.BeginOffset - b.BeginOffset || b.EndOffset - a.EndOffset
        );

        const nonOverlapping: PiiEntity[] = [];
        for (const entity of sortedAsc) {
            const prev = nonOverlapping[nonOverlapping.length - 1];
            if (!prev || entity.BeginOffset >= prev.EndOffset) {
                nonOverlapping.push({ ...entity });
            } else if (entity.EndOffset > prev.EndOffset) {
                prev.EndOffset = entity.EndOffset;
                if (entity.Score > prev.Score) {
                    prev.Type = entity.Type;
                    prev.Score = entity.Score;
                }
            }
        }

        let redactedText = text;
        for (let i = nonOverlapping.length - 1; i >= 0; i--) {
            const entity = nonOverlapping[i];
            const begin = Math.max(0, Math.min(entity.BeginOffset, redactedText.length));
            const end = Math.max(begin, Math.min(entity.EndOffset, redactedText.length));
            const spanLength = end - begin;

            let replacement: string;
            if (maskMode === "REPLACE_WITH_PII_ENTITY_TYPE") {
                replacement = `[${entity.Type}]`;
            } else if (maskMode === "CHARACTER_MASK") {
                replacement = maskCharacter.repeat(spanLength);
            } else {
                replacement = maskText || maskCharacter.repeat(5);
            }

            redactedText = redactedText.slice(0, begin) + replacement + redactedText.slice(end);
        }

        return {
            originalText: text,
            redactedText,
            entities: filteredEntities,
            redactedCount: nonOverlapping.length,
        };
    }

    /**
     * Redacts PII in a prompt or an array of chat messages for LLM Endpoints.
     */
    async redactEndpointInput<T extends EndpointChatInput>(
        chatInput: T,
        options: PiiRedactionOptions = {}
    ): Promise<{ redactedInput: T; entities: PiiEntity[] }> {
        const cloned: T = { ...chatInput };
        const collectedEntities: PiiEntity[] = [];

        if (typeof cloned.prompt === "string") {
            const res = await this.redactPii(cloned.prompt, options);
            cloned.prompt = res.redactedText;
            collectedEntities.push(...res.entities);
        }

        if (Array.isArray(cloned.messages)) {
            const redactedMessages: EndpointMessage[] = [];
            for (const msg of cloned.messages) {
                if (msg && typeof msg.content === "string") {
                    const res = await this.redactPii(msg.content, options);
                    redactedMessages.push({
                        ...msg,
                        content: res.redactedText,
                    });
                    collectedEntities.push(...res.entities);
                } else {
                    redactedMessages.push(msg);
                }
            }
            cloned.messages = redactedMessages;
        }

        return {
            redactedInput: cloned,
            entities: collectedEntities,
        };
    }

    /**
     * Creates an Observable stream that redacts PII from incoming text strings.
     */
    redactObservable(
        source: string | PiiObservable<string>,
        options: PiiRedactionOptions = {}
    ): PiiObservable<PiiRedactionResult> {
        const inputObs = typeof source === "string" ? PiiObservable.of(source) : source;
        return inputObs.flatMap((text) => this.redactPii(text, options));
    }

    /**
     * Creates an Observable stream that redacts PII from Endpoint chat options (prompt or messages).
     */
    redactPromptObservable<T extends EndpointChatInput>(
        source: T | PiiObservable<T>,
        options: PiiRedactionOptions = {}
    ): PiiObservable<{ redactedInput: T; entities: PiiEntity[] }> {
        const inputObs = source instanceof PiiObservable ? source : PiiObservable.of(source);
        return inputObs.flatMap((chatInput) => this.redactEndpointInput(chatInput, options));
    }

    /**
     * Operator function for PiiObservable.pipe() to redact strings in a stream.
     */
    redactOperator(
        options: PiiRedactionOptions = {}
    ): OperatorFunction<string, PiiRedactionResult> {
        return (source: PiiObservable<string>) =>
            source.flatMap((text) => this.redactPii(text, options));
    }

    /**
     * Chains PII redaction as an Observable directly with an EdgeChains Endpoint (OpenAI, GeminiAI, LlamaAI).
     */
    chainWithEndpoint<TInput extends EndpointChatInput, TOutput = any>(
        endpoint: ChainableEndpoint<TOutput>,
        chatInput: TInput | PiiObservable<TInput>,
        options: PiiRedactionOptions & {
            method?: "chat" | "streamedChat" | "chatWithFunction" | "zodSchemaResponse";
        } = {}
    ): PiiObservable<ChainedRedactionResponse<TInput, TOutput>> {
        const { method = "chat", ...redactionOptions } = options;
        const inputObs =
            chatInput instanceof PiiObservable ? chatInput : PiiObservable.of(chatInput);

        return inputObs.flatMap(async (originalInput) => {
            const { redactedInput, entities } = await this.redactEndpointInput(
                originalInput,
                redactionOptions
            );

            const targetMethod = (endpoint as any)[method];
            if (typeof targetMethod !== "function") {
                throw new Error(`Endpoint does not support method "${method}".`);
            }

            const response: TOutput = await targetMethod.call(endpoint, redactedInput);
            return {
                originalInput,
                redactedInput,
                entities,
                response,
            };
        });
    }

    /**
     * Wraps an existing EdgeChains Endpoint (e.g., OpenAI, GeminiAI, LlamaAI) so that all
     * chat requests automatically pass through the AWS Comprehend PII redaction Observable pipeline.
     */
    createRedactedEndpoint<TEndpoint extends ChainableEndpoint<any>>(
        endpoint: TEndpoint,
        defaultOptions: PiiRedactionOptions = {}
    ): RedactedEndpoint<TEndpoint> {
        const redactor: AWSComprehend = this;
        return {
            endpoint,
            redactor,
            chat: async (chatOptions: EndpointChatInput, options?: PiiRedactionOptions) => {
                const result = await this.chainWithEndpoint(endpoint, chatOptions, {
                    ...defaultOptions,
                    ...options,
                    method: "chat",
                }).toPromise();
                return result.response;
            },
            chatObservable: (chatOptions: EndpointChatInput, options?: PiiRedactionOptions) => {
                return this.chainWithEndpoint(endpoint, chatOptions, {
                    ...defaultOptions,
                    ...options,
                    method: "chat",
                });
            },
            streamedChat: async (chatOptions: EndpointChatInput, options?: PiiRedactionOptions) => {
                const result = await this.chainWithEndpoint(endpoint, chatOptions, {
                    ...defaultOptions,
                    ...options,
                    method: "streamedChat",
                }).toPromise();
                return result.response;
            },
            chatWithFunction: async (
                chatOptions: EndpointChatInput,
                options?: PiiRedactionOptions
            ) => {
                const result = await this.chainWithEndpoint(endpoint, chatOptions, {
                    ...defaultOptions,
                    ...options,
                    method: "chatWithFunction",
                }).toPromise();
                return result.response;
            },
            zodSchemaResponse: async (
                chatOptions: EndpointChatInput,
                options?: PiiRedactionOptions
            ) => {
                const result = await this.chainWithEndpoint(endpoint, chatOptions, {
                    ...defaultOptions,
                    ...options,
                    method: "zodSchemaResponse",
                }).toPromise();
                return result.response;
            },
        };
    }
}

export { AWSComprehend as ComprehendPiiRedactor, AWSComprehend as ComprehendEndpoint };

import axios, { AxiosRequestConfig } from "axios";
import { retry } from "@lifeomic/attempt";
import crypto from "crypto";

export type ComprehendLanguageCode =
    "en" | "es" | "fr" | "de" | "it" | "pt" | "ar" | "hi" | "ja" | "ko" | "zh" | "zh-TW";

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

export type PiiRedactionMode = "MASK" | "MASK_WITH_CHARACTER" | "REPLACE_WITH_PII_ENTITY_TYPE";

export interface PiiEntity {
    Score: number;
    Type: PiiEntityType;
    BeginOffset: number;
    EndOffset: number;
}

export interface PiiEntityLabel {
    Name: PiiEntityType;
    Score: number;
}

export interface AWSComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    endpoint?: string;
    languageCode?: ComprehendLanguageCode;
    minScore?: number;
    redactionMode?: PiiRedactionMode;
    maskCharacter?: string;
    maskMarker?: string;
    piiEntityTypes?: PiiEntityType[];
    maxRetry?: number;
    delay?: number;
}

export interface RedactOptions {
    languageCode?: ComprehendLanguageCode;
    minScore?: number;
    redactionMode?: PiiRedactionMode;
    maskCharacter?: string;
    maskMarker?: string;
    piiEntityTypes?: PiiEntityType[];
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
}

export interface Observer<T> {
    next?: (value: T) => void;
    error?: (err: any) => void;
    complete?: () => void;
}

export interface Subscription {
    unsubscribe(): void;
    readonly closed: boolean;
}

export type OperatorFunction<T, R> = (source: RedactionObservable<T>) => RedactionObservable<R>;

export interface ChainableEndpoint<TResponse = any> {
    chat?: (options: any) => Promise<TResponse>;
    gptFn?: (prompt: string) => Promise<TResponse>;
    gptFnChat?: (messages: any[]) => Promise<TResponse>;
    generateText?: (options: any) => Promise<TResponse>;
}

/**
 * Lightweight Observable implementation compatible with RxJS-style `.subscribe()`,
 * `.pipe()`, `.map()`, `.chain()`, and `await observable.toPromise()`.
 */
export class RedactionObservable<T> {
    private subscriberFn: (observer: Required<Observer<T>>) => void | (() => void);

    constructor(subscriberFn: (observer: Required<Observer<T>>) => void | (() => void)) {
        this.subscriberFn = subscriberFn;
    }

    static fromPromise<U>(promiseFactory: () => Promise<U>): RedactionObservable<U> {
        return new RedactionObservable<U>((observer) => {
            let cancelled = false;
            promiseFactory()
                .then((value) => {
                    if (!cancelled) {
                        observer.next(value);
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

    static of<U>(...values: U[]): RedactionObservable<U> {
        return new RedactionObservable<U>((observer) => {
            try {
                for (const val of values) {
                    observer.next(val);
                }
                observer.complete();
            } catch (err) {
                observer.error(err);
            }
        });
    }

    subscribe(
        observerOrNext?: Observer<T> | ((value: T) => void),
        error?: (err: any) => void,
        complete?: () => void
    ): Subscription {
        let closed = false;
        let teardown: void | (() => void);

        const normalizedObserver: Required<Observer<T>> =
            typeof observerOrNext === "function"
                ? {
                      next: (val: T) => {
                          if (!closed) observerOrNext(val);
                      },
                      error: (err: any) => {
                          if (!closed) {
                              closed = true;
                              if (error) error(err);
                          }
                      },
                      complete: () => {
                          if (!closed) {
                              closed = true;
                              if (complete) complete();
                          }
                      },
                  }
                : {
                      next: (val: T) => {
                          if (!closed && observerOrNext?.next) observerOrNext.next(val);
                      },
                      error: (err: any) => {
                          if (!closed) {
                              closed = true;
                              if (observerOrNext?.error) observerOrNext.error(err);
                          }
                      },
                      complete: () => {
                          if (!closed) {
                              closed = true;
                              if (observerOrNext?.complete) observerOrNext.complete();
                          }
                      },
                  };

        try {
            teardown = this.subscriberFn(normalizedObserver);
        } catch (err) {
            normalizedObserver.error(err);
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
                    }
                }
            },
        };
    }

    map<R>(project: (value: T) => R | Promise<R>): RedactionObservable<R> {
        return new RedactionObservable<R>((observer) => {
            let pending = 0;
            let upstreamCompleted = false;

            const sub = this.subscribe({
                next: (val) => {
                    pending += 1;
                    Promise.resolve()
                        .then(() => project(val))
                        .then((mapped) => {
                            observer.next(mapped);
                            pending -= 1;
                            if (upstreamCompleted && pending === 0) {
                                observer.complete();
                            }
                        })
                        .catch((err) => observer.error(err));
                },
                error: (err) => observer.error(err),
                complete: () => {
                    upstreamCompleted = true;
                    if (pending === 0) {
                        observer.complete();
                    }
                },
            });
            return () => sub.unsubscribe();
        });
    }

    pipe(): RedactionObservable<T>;
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

    /**
     * Chains the observable emission into an EdgeChains Endpoint class (OpenAI, GeminiAI, Palm2AI, etc.)
     * or custom async handler function, returning a new RedactionObservable of the endpoint's response.
     */
    chain<R = any>(
        endpoint: ChainableEndpoint<R> | ((value: T) => Promise<R> | R),
        chatOptions: Record<string, any> = {}
    ): RedactionObservable<R> {
        return this.map(async (emittedValue: T) => {
            if (typeof endpoint === "function") {
                return await endpoint(emittedValue);
            }
            const promptText =
                typeof emittedValue === "string"
                    ? emittedValue
                    : ((emittedValue as any)?.redactedText ?? String(emittedValue));

            if (typeof endpoint.chat === "function") {
                return await endpoint.chat({
                    ...chatOptions,
                    prompt: promptText,
                });
            }
            if (typeof endpoint.generateText === "function") {
                return await endpoint.generateText({
                    ...chatOptions,
                    prompt: promptText,
                });
            }
            if (typeof endpoint.gptFn === "function") {
                return await endpoint.gptFn(promptText);
            }
            throw new Error(
                "Provided endpoint does not implement chat(), generateText(), or gptFn()."
            );
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
                    if (hasValue) {
                        resolve(lastValue);
                    } else {
                        reject(new Error("Observable completed without emitting a value."));
                    }
                },
            });
        });
    }
}

/**
 * Pipeable operator for redacting PII from string or RedactionResult streams using AWSComprehend.
 */
export function redactPii(
    comprehend: AWSComprehend,
    options?: RedactOptions
): OperatorFunction<string, string> {
    return (source: RedactionObservable<string>) =>
        source.map((text: string) => comprehend.redactText(text, options));
}

/**
 * Chained endpoint wrapper that automatically redacts PII in `prompt` or `messages`
 * via AWS Comprehend before invoking the downstream LLM Endpoint.
 */
export class ChainedRedactionEndpoint<TResponse = any> {
    private comprehend: AWSComprehend;
    private endpoint:
        | ChainableEndpoint<TResponse>
        | ((redactedPrompt: string, redaction: RedactionResult) => Promise<TResponse> | TResponse);
    private defaultRedactOptions: RedactOptions;

    constructor(
        comprehend: AWSComprehend,
        endpoint:
            | ChainableEndpoint<TResponse>
            | ((
                  redactedPrompt: string,
                  redaction: RedactionResult
              ) => Promise<TResponse> | TResponse),
        defaultRedactOptions: RedactOptions = {}
    ) {
        this.comprehend = comprehend;
        this.endpoint = endpoint;
        this.defaultRedactOptions = defaultRedactOptions;
    }

    observeChat(
        chatOptions: Record<string, any>,
        redactOptions?: RedactOptions
    ): RedactionObservable<{
        response: TResponse;
        redaction?: RedactionResult;
        redactedMessages?: Array<{ role: string; content: string; [key: string]: any }>;
    }> {
        return RedactionObservable.fromPromise(() =>
            this.chatWithMetadata(chatOptions, redactOptions)
        );
    }

    async chatWithMetadata(
        chatOptions: Record<string, any>,
        redactOptions?: RedactOptions
    ): Promise<{
        response: TResponse;
        redaction?: RedactionResult;
        redactedMessages?: Array<{ role: string; content: string; [key: string]: any }>;
    }> {
        const mergedRedactOptions = { ...this.defaultRedactOptions, ...redactOptions };

        if (typeof this.endpoint === "function") {
            const promptToRedact = chatOptions.prompt || "";
            const redaction = await this.comprehend.redact(promptToRedact, mergedRedactOptions);
            const response = await this.endpoint(redaction.redactedText, redaction);
            return { response, redaction };
        }

        const updatedOptions: Record<string, any> = { ...chatOptions };
        let redaction: RedactionResult | undefined;
        let redactedMessages:
            Array<{ role: string; content: string; [key: string]: any }> | undefined;

        if (typeof chatOptions.prompt === "string") {
            redaction = await this.comprehend.redact(chatOptions.prompt, mergedRedactOptions);
            updatedOptions.prompt = redaction.redactedText;
        }

        if (Array.isArray(chatOptions.messages)) {
            redactedMessages = await this.comprehend.redactMessages(
                chatOptions.messages,
                mergedRedactOptions
            );
            updatedOptions.messages = redactedMessages;
        }

        if (typeof this.endpoint.chat === "function") {
            const response = await this.endpoint.chat(updatedOptions);
            return { response, redaction, redactedMessages };
        }

        if (typeof this.endpoint.generateText === "function") {
            const response = await this.endpoint.generateText(updatedOptions);
            return { response, redaction, redactedMessages };
        }

        if (typeof this.endpoint.gptFn === "function" && updatedOptions.prompt) {
            const response = await this.endpoint.gptFn(updatedOptions.prompt);
            return { response, redaction };
        }

        if (typeof this.endpoint.gptFnChat === "function" && updatedOptions.messages) {
            const response = await this.endpoint.gptFnChat(updatedOptions.messages);
            return { response, redactedMessages };
        }

        throw new Error("Downstream endpoint does not support chat, generateText, or gptFn.");
    }

    async chat(
        chatOptions: Record<string, any>,
        redactOptions?: RedactOptions
    ): Promise<TResponse> {
        const result = await this.chatWithMetadata(chatOptions, redactOptions);
        return result.response;
    }
}

export class AWSComprehend {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    endpoint: string;
    languageCode: ComprehendLanguageCode;
    minScore: number;
    redactionMode: PiiRedactionMode;
    maskCharacter: string;
    maskMarker?: string;
    piiEntityTypes: PiiEntityType[];
    maxRetry: number;
    delay: number;

    constructor(options: AWSComprehendOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.endpoint = options.endpoint || `https://comprehend.${this.region}.amazonaws.com/`;
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0.5;
        this.redactionMode = options.redactionMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || "*";
        this.maskMarker = options.maskMarker;
        this.piiEntityTypes = options.piiEntityTypes || ["ALL"];
        this.maxRetry = options.maxRetry || 3;
        this.delay = options.delay || 200;
    }

    private sha256(data: string): string {
        return crypto.createHash("sha256").update(data, "utf8").digest("hex");
    }

    private hmac(key: Buffer | string, data: string): Buffer {
        return crypto.createHmac("sha256", key).update(data, "utf8").digest();
    }

    private getSignatureKey(
        key: string,
        dateStamp: string,
        regionName: string,
        serviceName: string
    ): Buffer {
        const kDate = this.hmac("AWS4" + key, dateStamp);
        const kRegion = this.hmac(kDate, regionName);
        const kService = this.hmac(kRegion, serviceName);
        return this.hmac(kService, "aws4_request");
    }

    /**
     * Generates AWS Signature Version 4 headers for Amazon Comprehend JSON-RPC 1.1 requests.
     */
    public signRequest(
        amzTarget: string,
        payload: string,
        now: Date = new Date()
    ): Record<string, string> {
        const urlObj = new URL(this.endpoint);
        const host = urlObj.host;
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const service = "comprehend";
        const contentType = "application/x-amz-json-1.1";
        const payloadHash = this.sha256(payload);

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
            .map((k) => `${k}:${canonicalHeadersMap[k].trim()}\n`)
            .join("");
        const signedHeaders = sortedHeaderKeys.join(";");

        const canonicalRequest = [
            "POST",
            urlObj.pathname || "/",
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
            this.sha256(canonicalRequest),
        ].join("\n");

        const signingKey = this.getSignatureKey(
            this.secretAccessKey,
            dateStamp,
            this.region,
            service
        );
        const signature = crypto
            .createHmac("sha256", signingKey)
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

    private async callComprehend<T>(action: string, body: Record<string, any>): Promise<T> {
        const amzTarget = `Comprehend_20171127.${action}`;
        const payload = JSON.stringify(body);
        const headers = this.signRequest(amzTarget, payload);

        const config: AxiosRequestConfig = {
            method: "post",
            url: this.endpoint,
            headers,
            data: payload,
        };

        return await retry(
            async () => {
                const response = await axios.request<T>(config);
                return response.data;
            },
            { maxAttempts: this.maxRetry, delay: this.delay }
        );
    }

    /**
     * Calls Amazon Comprehend `DetectPiiEntities` API to locate PII entities and their character offsets.
     */
    async detectPiiEntities(
        text: string,
        languageCode: ComprehendLanguageCode = this.languageCode
    ): Promise<PiiEntity[]> {
        if (!text) {
            return [];
        }
        const data = await this.callComprehend<{ Entities?: PiiEntity[] }>("DetectPiiEntities", {
            Text: text,
            LanguageCode: languageCode,
        });
        return data?.Entities || [];
    }

    /**
     * Calls Amazon Comprehend `ContainsPiiEntities` API to classify whether text contains PII types.
     */
    async containsPiiEntities(
        text: string,
        languageCode: ComprehendLanguageCode = this.languageCode
    ): Promise<PiiEntityLabel[]> {
        if (!text) {
            return [];
        }
        const data = await this.callComprehend<{ Labels?: PiiEntityLabel[] }>(
            "ContainsPiiEntities",
            {
                Text: text,
                LanguageCode: languageCode,
            }
        );
        return data?.Labels || [];
    }

    /**
     * Applies PII redaction to `text` given a list of detected `PiiEntity` items.
     */
    public applyRedaction(
        text: string,
        entities: PiiEntity[],
        options: RedactOptions = {}
    ): RedactionResult {
        const minScore = options.minScore ?? this.minScore;
        const redactionMode = options.redactionMode || this.redactionMode;
        const maskCharacter = options.maskCharacter || this.maskCharacter || "*";
        const maskMarker = options.maskMarker ?? this.maskMarker;
        const allowedTypes = options.piiEntityTypes || this.piiEntityTypes || ["ALL"];
        const allowAll = allowedTypes.includes("ALL");

        const filteredEntities = entities
            .filter((entity) => {
                const meetsScore = (entity.Score ?? 1) >= minScore;
                const meetsType = allowAll || allowedTypes.includes(entity.Type);
                const validOffsets =
                    typeof entity.BeginOffset === "number" &&
                    typeof entity.EndOffset === "number" &&
                    entity.BeginOffset >= 0 &&
                    entity.EndOffset <= text.length &&
                    entity.BeginOffset < entity.EndOffset;
                return meetsScore && meetsType && validOffsets;
            })
            .sort((a, b) => a.BeginOffset - b.BeginOffset || b.EndOffset - a.EndOffset);

        // Deduplicate/resolve overlapping spans cleanly
        const nonOverlapping: PiiEntity[] = [];
        for (const entity of filteredEntities) {
            const prev = nonOverlapping[nonOverlapping.length - 1];
            if (!prev || entity.BeginOffset >= prev.EndOffset) {
                nonOverlapping.push(entity);
            } else if (entity.EndOffset > prev.EndOffset && entity.Score > prev.Score) {
                nonOverlapping[nonOverlapping.length - 1] = entity;
            }
        }

        let cursor = 0;
        let redactedText = "";

        for (const entity of nonOverlapping) {
            redactedText += text.slice(cursor, entity.BeginOffset);
            const spanLength = entity.EndOffset - entity.BeginOffset;

            if (redactionMode === "REPLACE_WITH_PII_ENTITY_TYPE") {
                redactedText += `[${entity.Type}]`;
            } else if (maskMarker) {
                redactedText += maskMarker;
            } else {
                redactedText += maskCharacter.repeat(spanLength);
            }
            cursor = entity.EndOffset;
        }

        redactedText += text.slice(cursor);

        return {
            originalText: text,
            redactedText,
            entities: nonOverlapping,
        };
    }

    /**
     * Detects and redacts PII entities from the input text.
     */
    async redact(text: string, options: RedactOptions = {}): Promise<RedactionResult> {
        if (!text) {
            return { originalText: text, redactedText: text, entities: [] };
        }
        const languageCode = options.languageCode || this.languageCode;
        const entities = await this.detectPiiEntities(text, languageCode);
        return this.applyRedaction(text, entities, options);
    }

    /**
     * Convenience method returning only the redacted prompt string.
     */
    async redactText(text: string, options: RedactOptions = {}): Promise<string> {
        const res = await this.redact(text, options);
        return res.redactedText;
    }

    /**
     * Redacts PII across an array of chat messages (`{ role, content }`).
     */
    async redactMessages<M extends { role: string; content: string; [key: string]: any }>(
        messages: M[],
        options: RedactOptions = {}
    ): Promise<M[]> {
        const redacted: M[] = [];
        for (const msg of messages) {
            if (typeof msg.content === "string" && msg.content.length > 0) {
                const redactedContent = await this.redactText(msg.content, options);
                redacted.push({ ...msg, content: redactedContent });
            } else {
                redacted.push({ ...msg });
            }
        }
        return redacted;
    }

    /**
     * Creates an Observable emitting the full `RedactionResult` (`{ originalText, redactedText, entities }`),
     * which can be chained with `.chain(endpoint)` or `.map(...)` / `.pipe(...)`.
     */
    observe(text: string, options: RedactOptions = {}): RedactionObservable<RedactionResult> {
        return RedactionObservable.fromPromise(() => this.redact(text, options));
    }

    /**
     * Creates an Observable emitting the redacted prompt string, ready to chain with Endpoint classes.
     */
    redactObservable(text: string, options: RedactOptions = {}): RedactionObservable<string> {
        return RedactionObservable.fromPromise(() => this.redactText(text, options));
    }

    /**
     * Chains this AWSComprehend instance with an existing EdgeChains Endpoint class (e.g., `OpenAI`, `GeminiAI`)
     * or custom handler function so all prompts/messages are automatically redacted before LLM invocation.
     */
    chain<TResponse = any>(
        endpoint:
            | ChainableEndpoint<TResponse>
            | ((
                  redactedPrompt: string,
                  redaction: RedactionResult
              ) => Promise<TResponse> | TResponse),
        defaultRedactOptions: RedactOptions = {}
    ): ChainedRedactionEndpoint<TResponse> {
        return new ChainedRedactionEndpoint<TResponse>(this, endpoint, defaultRedactOptions);
    }
}

export { AWSComprehend as AWSComprehendPIIRedactor, AWSComprehend as ComprehendEndpoint };

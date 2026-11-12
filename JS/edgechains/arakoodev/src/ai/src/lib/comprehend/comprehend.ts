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
    | string;

export type MaskMode = "MASK" | "REPLACE_WITH_PII_ENTITY_TYPE";

export interface PiiEntity {
    Type: PiiEntityType;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface PiiLabel {
    Name: PiiEntityType;
    Score: number;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
    piiTypesRedacted: string[];
}

export interface ComprehendClientLike {
    detectPiiEntities?: (params: { Text: string; LanguageCode: string }) => Promise<{ Entities?: PiiEntity[] }>;
    containsPiiEntities?: (params: { Text: string; LanguageCode: string }) => Promise<{ Labels?: PiiLabel[] }>;
}

export interface AWSComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    confidenceThreshold?: number;
    piiEntityTypes?: PiiEntityType[];
    maskMode?: MaskMode;
    maskCharacter?: string;
    endpointUrl?: string;
    client?: ComprehendClientLike;
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

export type OperatorFunction<T, R> = (source: PiiObservable<T>) => PiiObservable<R>;

/**
 * Lightweight Observable implementation compatible with RxJS/TC39 Observable pipelines
 * for chaining AWS Comprehend PII redaction with EdgeChains Endpoint classes.
 */
export class PiiObservable<T> {
    private _subscribe: (observer: Required<Observer<T>>) => (() => void) | void;

    constructor(subscribe: (observer: Required<Observer<T>>) => (() => void) | void) {
        this._subscribe = subscribe;
    }

    static of<U>(...items: U[]): PiiObservable<U> {
        return new PiiObservable<U>((observer) => {
            for (const item of items) {
                observer.next(item);
            }
            observer.complete();
        });
    }

    static from<U>(input: U | Promise<U> | Iterable<U> | PiiObservable<U>): PiiObservable<U> {
        if (input instanceof PiiObservable) {
            return input;
        }
        if (input && typeof (input as Promise<U>).then === "function") {
            return new PiiObservable<U>((observer) => {
                let cancelled = false;
                (input as Promise<U>)
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
        if (typeof input !== "string" && input && typeof (input as Iterable<U>)[Symbol.iterator] === "function") {
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
        return PiiObservable.of(input as U);
    }

    subscribe(
        observerOrNext?: Observer<T> | ((value: T) => void),
        error?: (err: unknown) => void,
        complete?: () => void
    ): Subscription {
        let closed = false;
        let teardown: (() => void) | void;

        const observer: Required<Observer<T>> =
            typeof observerOrNext === "function"
                ? {
                      next: (val: T) => {
                          if (!closed) observerOrNext(val);
                      },
                      error: (err: unknown) => {
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
                      error: (err: unknown) => {
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
            teardown = this._subscribe(observer);
        } catch (err) {
            observer.error(err);
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

    switchMap<R>(project: (value: T) => PiiObservable<R> | Promise<R>): PiiObservable<R> {
        return new PiiObservable<R>((observer) => {
            let innerSub: Subscription | null = null;
            let outerCompleted = false;
            let activeInner = false;

            const outerSub = this.subscribe({
                next: (val) => {
                    if (innerSub) {
                        innerSub.unsubscribe();
                    }
                    activeInner = true;
                    let inner$: PiiObservable<R>;
                    try {
                        const projected = project(val);
                        inner$ = projected instanceof PiiObservable ? projected : PiiObservable.from(projected);
                    } catch (err) {
                        observer.error(err);
                        return;
                    }
                    innerSub = inner$.subscribe({
                        next: (innerVal) => observer.next(innerVal),
                        error: (err) => observer.error(err),
                        complete: () => {
                            activeInner = false;
                            if (outerCompleted) {
                                observer.complete();
                            }
                        },
                    });
                },
                error: (err) => observer.error(err),
                complete: () => {
                    outerCompleted = true;
                    if (!activeInner) {
                        observer.complete();
                    }
                },
            });

            return () => {
                if (innerSub) innerSub.unsubscribe();
                outerSub.unsubscribe();
            };
        });
    }

    pipe(): PiiObservable<T>;
    pipe<A>(op1: OperatorFunction<T, A>): PiiObservable<A>;
    pipe<A, B>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): PiiObservable<B>;
    pipe<A, B, C>(
        op1: OperatorFunction<T, A>,
        op2: OperatorFunction<A, B>,
        op3: OperatorFunction<B, C>
    ): PiiObservable<C>;
    pipe(...operations: OperatorFunction<any, any>[]): PiiObservable<any> {
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
                        resolve(lastValue!);
                    } else {
                        reject(new Error("Observable completed without emitting a value"));
                    }
                },
            });
        });
    }
}

/**
 * AWS Comprehend PII detection and redaction utility for EdgeChains.
 * Can be chained as an Observable or Promise pipeline with existing AI Endpoint classes
 * (OpenAI, GeminiAI, LlamaAI) to redact sensitive PII from prompts and chat messages.
 */
export class AWSComprehend {
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
    readonly languageCode: string;
    readonly confidenceThreshold: number;
    readonly piiEntityTypes: PiiEntityType[];
    readonly maskMode: MaskMode;
    readonly maskCharacter: string;
    readonly endpointUrl: string;
    private client?: ComprehendClientLike;

    constructor(options: AWSComprehendOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.languageCode = options.languageCode || "en";
        this.confidenceThreshold = options.confidenceThreshold ?? 0.5;
        this.piiEntityTypes = options.piiEntityTypes || ["ALL"];
        this.maskMode = options.maskMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || "*";
        this.endpointUrl =
            options.endpointUrl || `https://comprehend.${this.region}.amazonaws.com/`;
        this.client = options.client;
    }

    private signAwsRequest(
        target: string,
        payload: string,
        now: Date = new Date()
    ): Record<string, string> {
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const service = "comprehend";
        const host = new URL(this.endpointUrl).host;
        const contentType = "application/x-amz-json-1.1";

        const payloadHash = crypto.createHash("sha256").update(payload, "utf8").digest("hex");

        const canonicalHeaders =
            `content-type:${contentType}\n` +
            `host:${host}\n` +
            `x-amz-date:${amzDate}\n` +
            (this.sessionToken ? `x-amz-security-token:${this.sessionToken}\n` : "") +
            `x-amz-target:${target}\n`;

        const signedHeaders =
            "content-type;host;x-amz-date;" +
            (this.sessionToken ? "x-amz-security-token;" : "") +
            "x-amz-target";

        const canonicalRequest = [
            "POST",
            "/",
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
            crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
        ].join("\n");

        const hmac = (key: Buffer | string, data: string): Buffer =>
            crypto.createHmac("sha256", key).update(data, "utf8").digest();

        const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = hmac(kDate, this.region);
        const kService = hmac(kRegion, service);
        const kSigning = hmac(kService, "aws4_request");
        const signature = crypto
            .createHmac("sha256", kSigning)
            .update(stringToSign, "utf8")
            .digest("hex");

        const authorizationHeader =
            `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            Host: host,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": target,
            Authorization: authorizationHeader,
        };

        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }

        return headers;
    }

    private shouldRedactEntity(entity: PiiEntity): boolean {
        if ((entity.Score ?? 0) < this.confidenceThreshold) {
            return false;
        }
        if (this.piiEntityTypes.includes("ALL")) {
            return true;
        }
        return this.piiEntityTypes.includes(entity.Type);
    }

    /**
     * Calls AWS Comprehend DetectPiiEntities API to locate PII entities and character offsets.
     */
    async detectPiiEntities(text: string, languageCode?: string): Promise<PiiEntity[]> {
        if (!text || text.trim().length === 0) {
            return [];
        }

        const lang = languageCode || this.languageCode;

        if (this.client?.detectPiiEntities) {
            const res = await this.client.detectPiiEntities({
                Text: text,
                LanguageCode: lang,
            });
            return (res.Entities || []).filter((entity) => this.shouldRedactEntity(entity));
        }

        const payload = JSON.stringify({
            Text: text,
            LanguageCode: lang,
        });

        const headers = this.signAwsRequest(
            "ComprehendService_20171127.DetectPiiEntities",
            payload
        );

        const response = await axios.post(this.endpointUrl, payload, { headers });
        const entities: PiiEntity[] = response?.data?.Entities || [];
        return entities.filter((entity) => this.shouldRedactEntity(entity));
    }

    /**
     * Calls AWS Comprehend ContainsPiiEntities API to classify PII labels present in text.
     */
    async containsPiiEntities(text: string, languageCode?: string): Promise<PiiLabel[]> {
        if (!text || text.trim().length === 0) {
            return [];
        }

        const lang = languageCode || this.languageCode;

        if (this.client?.containsPiiEntities) {
            const res = await this.client.containsPiiEntities({
                Text: text,
                LanguageCode: lang,
            });
            return (res.Labels || []).filter((label) => (label.Score ?? 0) >= this.confidenceThreshold);
        }

        const payload = JSON.stringify({
            Text: text,
            LanguageCode: lang,
        });

        const headers = this.signAwsRequest(
            "ComprehendService_20171127.ContainsPiiEntities",
            payload
        );

        const response = await axios.post(this.endpointUrl, payload, { headers });
        const labels: PiiLabel[] = response?.data?.Labels || [];
        return labels.filter((label) => (label.Score ?? 0) >= this.confidenceThreshold);
    }

    /**
     * Applies redaction to the source text given detected AWS Comprehend PII entities.
     * Follows the AWS Comprehend offset redaction pattern (`[ENTITY_TYPE]` or character mask).
     */
    applyRedaction(text: string, entities: PiiEntity[]): RedactionResult {
        if (!text || entities.length === 0) {
            return {
                originalText: text,
                redactedText: text,
                entities: [],
                piiTypesRedacted: [],
            };
        }

        const filtered = entities
            .filter(
                (e) =>
                    this.shouldRedactEntity(e) &&
                    typeof e.BeginOffset === "number" &&
                    typeof e.EndOffset === "number" &&
                    e.BeginOffset >= 0 &&
                    e.EndOffset <= text.length &&
                    e.BeginOffset < e.EndOffset
            )
            .sort((a, b) => a.BeginOffset - b.BeginOffset || b.EndOffset - a.EndOffset);

        const nonOverlapping: PiiEntity[] = [];
        for (const entity of filtered) {
            const prev = nonOverlapping[nonOverlapping.length - 1];
            if (!prev || entity.BeginOffset >= prev.EndOffset) {
                nonOverlapping.push(entity);
            }
        }

        let redactedText = "";
        let cursor = 0;
        const piiTypesSet = new Set<string>();

        for (const entity of nonOverlapping) {
            redactedText += text.slice(cursor, entity.BeginOffset);
            if (this.maskMode === "MASK") {
                const spanLength = entity.EndOffset - entity.BeginOffset;
                redactedText += this.maskCharacter.repeat(spanLength);
            } else {
                redactedText += `[${entity.Type}]`;
            }
            piiTypesSet.add(entity.Type);
            cursor = entity.EndOffset;
        }
        redactedText += text.slice(cursor);

        return {
            originalText: text,
            redactedText,
            entities: nonOverlapping,
            piiTypesRedacted: Array.from(piiTypesSet),
        };
    }

    /**
     * Detects and redacts PII from the input text using AWS Comprehend.
     */
    async redact(text: string): Promise<RedactionResult> {
        const entities = await this.detectPiiEntities(text);
        return this.applyRedaction(text, entities);
    }

    /**
     * Convenience method returning only the redacted prompt string.
     */
    async redactText(text: string): Promise<string> {
        const result = await this.redact(text);
        return result.redactedText;
    }

    /**
     * Redacts PII across an array of chat messages (`{ role, content }`).
     */
    async redactMessages<M extends { role: string; content: string }>(messages: M[]): Promise<M[]> {
        const redacted: M[] = [];
        for (const msg of messages) {
            const redactedContent = await this.redactText(msg.content);
            redacted.push({
                ...msg,
                content: redactedContent,
            });
        }
        return redacted;
    }

    /**
     * Creates an Observable emitting `RedactionResult` for a prompt or upstream string Observable.
     */
    redactObservable(source: string | PiiObservable<string>): PiiObservable<RedactionResult> {
        const source$ = typeof source === "string" ? PiiObservable.of(source) : source;
        return source$.switchMap((text) => this.redact(text));
    }

    /**
     * Returns a pipeable Observable operator that redacts PII from prompt strings in a stream.
     */
    asOperator(): OperatorFunction<string, string> {
        return (source$: PiiObservable<string>) =>
            source$.switchMap((text) => this.redactText(text));
    }

    /**
     * Chains PII redaction with an existing Endpoint instance (`OpenAI`, `GeminiAI`, `LlamaAI`)
     * or custom handler as an Observable pipeline.
     */
    chainObservable<R = any>(
        source: string | PiiObservable<string>,
        endpointOrHandler:
            | { chat: (options: any) => Promise<R> | R }
            | ((redactedPrompt: string, redaction: RedactionResult) => Promise<R> | PiiObservable<R>),
        chatOptions: Record<string, any> = {}
    ): PiiObservable<R> {
        return this.redactObservable(source).switchMap((redaction) => {
            if (typeof endpointOrHandler === "function") {
                return endpointOrHandler(redaction.redactedText, redaction);
            }
            const result = endpointOrHandler.chat({
                ...chatOptions,
                prompt: redaction.redactedText,
            });
            return Promise.resolve(result);
        });
    }

    /**
     * Chains PII redaction with an existing Endpoint instance or callback and resolves as a Promise.
     */
    async chain<R = any>(
        prompt: string,
        endpointOrHandler:
            | { chat: (options: any) => Promise<R> | R }
            | ((redactedPrompt: string, redaction: RedactionResult) => Promise<R>),
        chatOptions: Record<string, any> = {}
    ): Promise<R> {
        return this.chainObservable(prompt, endpointOrHandler, chatOptions).toPromise();
    }

    /**
     * Wraps an existing EdgeChains Endpoint (`OpenAI`, `GeminiAI`, `LlamaAI`) so every `.chat()`
     * call automatically redacts sensitive PII in `prompt` or `messages` before sending.
     */
    wrapEndpoint<E extends { chat: (options: any) => any }>(endpoint: E): E {
        const comprehend = this;
        return new Proxy(endpoint, {
            get(target, prop, receiver) {
                if (prop === "chat") {
                    return async (options: Record<string, any>) => {
                        const sanitizedOptions = { ...options };
                        if (typeof sanitizedOptions.prompt === "string") {
                            sanitizedOptions.prompt = await comprehend.redactText(
                                sanitizedOptions.prompt
                            );
                        }
                        if (Array.isArray(sanitizedOptions.messages)) {
                            sanitizedOptions.messages = await comprehend.redactMessages(
                                sanitizedOptions.messages
                            );
                        }
                        return target.chat(sanitizedOptions);
                    };
                }
                const value = Reflect.get(target, prop, receiver);
                return typeof value === "function" ? value.bind(target) : value;
            },
        });
    }
}

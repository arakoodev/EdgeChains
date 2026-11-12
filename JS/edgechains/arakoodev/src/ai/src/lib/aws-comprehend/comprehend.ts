import axios, { AxiosInstance } from "axios";
import crypto from "crypto";

export type PiiMaskMode = "REPLACE_WITH_PII_ENTITY_TYPE" | "MASK";

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

export interface AWSComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    maskMode?: PiiMaskMode;
    maskCharacter?: string;
    minConfidenceScore?: number;
    entityTypes?: string[];
    endpoint?: string;
}

export interface RedactPiiOptions {
    languageCode?: string;
    maskMode?: PiiMaskMode;
    maskCharacter?: string;
    minConfidenceScore?: number;
    entityTypes?: string[];
}

export interface RedactPiiResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
}

export interface SubscribableObserver<T> {
    next?: (value: T) => void;
    error?: (err: any) => void;
    complete?: () => void;
}

export type OperatorFunction<T, R> = (source: RedactionObservable<T>) => RedactionObservable<R>;

/**
 * Lightweight Observable implementation supporting `.pipe(...)` and `.subscribe(...)`
 * so prompts and LLM Endpoint calls can be composed and chained as observables.
 */
export class RedactionObservable<T> {
    constructor(
        private readonly subscribeFn: (
            observer: Required<SubscribableObserver<T>>
        ) => void | (() => void)
    ) {}

    static of<U>(...items: U[]): RedactionObservable<U> {
        return new RedactionObservable<U>((observer) => {
            for (const item of items) {
                observer.next(item);
            }
            observer.complete();
        });
    }

    static fromPromise<U>(promiseFactory: () => Promise<U>): RedactionObservable<U> {
        return new RedactionObservable<U>((observer) => {
            promiseFactory()
                .then((val) => {
                    observer.next(val);
                    observer.complete();
                })
                .catch((err) => observer.error(err));
        });
    }

    pipe<A>(op1: OperatorFunction<T, A>): RedactionObservable<A>;
    pipe<A, B>(
        op1: OperatorFunction<T, A>,
        op2: OperatorFunction<A, B>
    ): RedactionObservable<B>;
    pipe<A, B, C>(
        op1: OperatorFunction<T, A>,
        op2: OperatorFunction<A, B>,
        op3: OperatorFunction<B, C>
    ): RedactionObservable<C>;
    pipe(...operations: OperatorFunction<any, any>[]): RedactionObservable<any> {
        return operations.reduce((prev, fn) => fn(prev), this as RedactionObservable<any>);
    }

    subscribe(
        observerOrNext?: SubscribableObserver<T> | ((value: T) => void),
        error?: (err: any) => void,
        complete?: () => void
    ): { unsubscribe: () => void } {
        const observer: Required<SubscribableObserver<T>> =
            typeof observerOrNext === "function"
                ? {
                      next: observerOrNext,
                      error: error || (() => {}),
                      complete: complete || (() => {}),
                  }
                : {
                      next: observerOrNext?.next || (() => {}),
                      error: observerOrNext?.error || (() => {}),
                      complete: observerOrNext?.complete || (() => {}),
                  };

        const teardown = this.subscribeFn(observer);
        return {
            unsubscribe: () => {
                if (typeof teardown === "function") {
                    teardown();
                }
            },
        };
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
                        reject(new Error("Observable completed without emitting a value."));
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

export class AWSComprehend {
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
    readonly languageCode: string;
    readonly maskMode: PiiMaskMode;
    readonly maskCharacter: string;
    readonly minConfidenceScore: number;
    readonly entityTypes?: string[];
    readonly endpoint: string;
    private readonly http: AxiosInstance;

    constructor(options: AWSComprehendOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.languageCode = options.languageCode || "en";
        this.maskMode = options.maskMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || "*";
        this.minConfidenceScore = options.minConfidenceScore ?? 0.5;
        this.entityTypes = options.entityTypes;
        this.endpoint =
            options.endpoint || `https://comprehend.${this.region}.amazonaws.com/`;

        this.http = axios.create({
            baseURL: this.endpoint,
        });
    }

    private signRequest(target: string, payload: string, now: Date = new Date()): Record<string, string> {
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const urlObj = new URL(this.endpoint);
        const host = urlObj.host;
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

        const authorizationHeader =
            `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "X-Amz-Date": amzDate,
            "X-Amz-Target": target,
            Authorization: authorizationHeader,
        };
        if (this.sessionToken) {
            headers["X-Amz-Security-Token"] = this.sessionToken;
        }
        return headers;
    }

    /**
     * Calls AWS Comprehend `DetectPiiEntities` API to locate PII offsets in text.
     */
    async detectPiiEntities(
        text: string,
        languageCode: string = this.languageCode
    ): Promise<PiiEntity[]> {
        if (!text) {
            return [];
        }
        const target = "Comprehend_20171127.DetectPiiEntities";
        const body = JSON.stringify({
            Text: text,
            LanguageCode: languageCode,
        });
        const headers = this.signRequest(target, body);
        const response = await this.http.post("/", body, { headers });
        return Array.isArray(response.data?.Entities) ? response.data.Entities : [];
    }

    /**
     * Calls AWS Comprehend `ContainsPiiEntities` API to classify PII types present in text.
     */
    async containsPiiEntities(
        text: string,
        languageCode: string = this.languageCode
    ): Promise<PiiEntityLabel[]> {
        if (!text) {
            return [];
        }
        const target = "Comprehend_20171127.ContainsPiiEntities";
        const body = JSON.stringify({
            Text: text,
            LanguageCode: languageCode,
        });
        const headers = this.signRequest(target, body);
        const response = await this.http.post("/", body, { headers });
        return Array.isArray(response.data?.Labels) ? response.data.Labels : [];
    }

    /**
     * Detects and redacts sensitive PII entities from a string prompt.
     */
    async redactPii(text: string, options: RedactPiiOptions = {}): Promise<RedactPiiResult> {
        if (!text) {
            return { originalText: text, redactedText: text, entities: [] };
        }

        const languageCode = options.languageCode || this.languageCode;
        const maskMode = options.maskMode || this.maskMode;
        const maskCharacter = options.maskCharacter || this.maskCharacter;
        const minConfidenceScore = options.minConfidenceScore ?? this.minConfidenceScore;
        const allowedTypes = options.entityTypes || this.entityTypes;

        const detected = await this.detectPiiEntities(text, languageCode);
        const filtered = detected
            .filter((entity) => {
                if (typeof entity.Score === "number" && entity.Score < minConfidenceScore) {
                    return false;
                }
                if (Array.isArray(allowedTypes) && allowedTypes.length > 0) {
                    return allowedTypes.includes(entity.Type);
                }
                return true;
            })
            .sort((a, b) => a.BeginOffset - b.BeginOffset);

        let redactedText = text;
        for (let i = filtered.length - 1; i >= 0; i--) {
            const entity = filtered[i];
            const start = Math.max(0, entity.BeginOffset);
            const end = Math.min(redactedText.length, entity.EndOffset);
            if (end <= start) continue;

            const replacement =
                maskMode === "MASK"
                    ? maskCharacter.repeat(end - start)
                    : `[${entity.Type}]`;

            redactedText =
                redactedText.slice(0, start) + replacement + redactedText.slice(end);
        }

        return {
            originalText: text,
            redactedText,
            entities: filtered,
        };
    }

    /**
     * Convenience method returning only the redacted prompt string.
     */
    async redactText(text: string, options: RedactPiiOptions = {}): Promise<string> {
        const result = await this.redactPii(text, options);
        return result.redactedText;
    }

    /**
     * Redacts PII in an Endpoint chat options object (`prompt` and/or `messages`).
     */
    async redactChatOptions<
        T extends {
            prompt?: string;
            messages?: Array<{ role: string; content: string; name?: string }>;
            [key: string]: any;
        },
    >(chatOptions: T, options: RedactPiiOptions = {}): Promise<T> {
        const cloned: T = { ...chatOptions };
        if (typeof cloned.prompt === "string") {
            cloned.prompt = await this.redactText(cloned.prompt, options);
        }
        if (Array.isArray(cloned.messages)) {
            cloned.messages = await Promise.all(
                cloned.messages.map(async (msg) => ({
                    ...msg,
                    content:
                        typeof msg.content === "string"
                            ? await this.redactText(msg.content, options)
                            : msg.content,
                }))
            );
        }
        return cloned;
    }

    /**
     * Creates a pipeable Observable operator that redacts PII from string prompts or chat option payloads.
     */
    asOperator(options: RedactPiiOptions = {}): OperatorFunction<any, any> {
        return (source: RedactionObservable<any>) =>
            new RedactionObservable<any>((observer) => {
                const sub = source.subscribe({
                    next: (input) => {
                        const processPromise =
                            typeof input === "string"
                                ? this.redactText(input, options)
                                : input && typeof input === "object"
                                  ? this.redactChatOptions(input, options)
                                  : Promise.resolve(input);

                        processPromise
                            .then((redacted) => observer.next(redacted))
                            .catch((err) => observer.error(err));
                    },
                    error: (err) => observer.error(err),
                    complete: () => {
                        // Defer completion slightly so async next handlers settle in order
                        Promise.resolve().then(() => observer.complete());
                    },
                });
                return () => sub.unsubscribe();
            });
    }

    /**
     * Wraps an existing EdgeChains Endpoint instance (e.g., `OpenAI`, `GeminiAI`, `LlamaAI`)
     * so that `.chat(...)`, `.streamedChat(...)`, `.chatWithFunction(...)`, and `.generateEmbeddings(...)`
     * automatically redact PII before forwarding to the underlying endpoint, and also exposes
     * `.observeChat(chatOptions)` returning a `RedactionObservable`.
     */
    chainWithEndpoint<E extends Record<string, any>>(
        endpoint: E,
        options: RedactPiiOptions = {}
    ): E & {
        observeChat: (chatOptions: any) => RedactionObservable<any>;
    } {
        const redactor = this;
        const chained = Object.create(endpoint);

        if (typeof endpoint.chat === "function") {
            chained.chat = async (chatOptions: any) => {
                const safeOptions =
                    typeof chatOptions === "string"
                        ? await redactor.redactText(chatOptions, options)
                        : await redactor.redactChatOptions(chatOptions, options);
                return endpoint.chat(safeOptions);
            };
        }

        if (typeof endpoint.streamedChat === "function") {
            chained.streamedChat = async (chatOptions: any) => {
                const safeOptions = await redactor.redactChatOptions(chatOptions, options);
                return endpoint.streamedChat(safeOptions);
            };
        }

        if (typeof endpoint.chatWithFunction === "function") {
            chained.chatWithFunction = async (chatOptions: any) => {
                const safeOptions = await redactor.redactChatOptions(chatOptions, options);
                return endpoint.chatWithFunction(safeOptions);
            };
        }

        if (typeof endpoint.generateEmbeddings === "function") {
            chained.generateEmbeddings = async (embedOptions: any) => {
                if (embedOptions && Array.isArray(embedOptions.input)) {
                    const redactedInputs = await Promise.all(
                        embedOptions.input.map((item: string) =>
                            redactor.redactText(item, options)
                        )
                    );
                    return endpoint.generateEmbeddings({
                        ...embedOptions,
                        input: redactedInputs,
                    });
                }
                return endpoint.generateEmbeddings(embedOptions);
            };
        }

        chained.observeChat = (chatOptions: any): RedactionObservable<any> => {
            return new RedactionObservable((observer) => {
                chained
                    .chat(chatOptions)
                    .then((res: any) => {
                        observer.next(res);
                        observer.complete();
                    })
                    .catch((err: any) => observer.error(err));
            });
        };

        return chained;
    }
}

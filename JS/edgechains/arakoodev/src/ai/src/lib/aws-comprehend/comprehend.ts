import axios from "axios";
import crypto from "crypto";
import { retry } from "@lifeomic/attempt";

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
    | "ALL";

export interface PiiEntity {
    Type: PiiEntityType | string;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface PiiLabel {
    Name: PiiEntityType | string;
    Score: number;
}

export type RedactionMode = "MASK" | "ENTITY_TYPE";

export interface AwsComprehendOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
    languageCode?: string;
    minScore?: number;
    entityTypes?: (PiiEntityType | string)[];
    redactionMode?: RedactionMode;
    maskCharacter?: string;
    maxRetry?: number;
    delay?: number;
}

export interface RedactPromptResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
    redactedCount: number;
}

export interface ChatEndpointLike {
    chat(options: any): Promise<any>;
}

export interface Observer<T> {
    next?: (value: T) => void;
    error?: (err: any) => void;
    complete?: () => void;
}

export interface Subscription {
    unsubscribe(): void;
}

export class PromptRedactionObservable<T> {
    private producer: () => Promise<T>;

    constructor(producer: () => Promise<T>) {
        this.producer = producer;
    }

    subscribe(
        observerOrNext?: Observer<T> | ((value: T) => void),
        error?: (err: any) => void,
        complete?: () => void
    ): Subscription {
        let active = true;
        const observer: Observer<T> =
            typeof observerOrNext === "function"
                ? { next: observerOrNext, error, complete }
                : observerOrNext || {};

        this.producer()
            .then((val) => {
                if (!active) return;
                observer.next?.(val);
                observer.complete?.();
            })
            .catch((err) => {
                if (!active) return;
                if (observer.error) {
                    observer.error(err);
                }
            });

        return {
            unsubscribe() {
                active = false;
            },
        };
    }

    map<U>(transform: (value: T) => U | Promise<U>): PromptRedactionObservable<U> {
        return new PromptRedactionObservable<U>(async () => {
            const val = await this.producer();
            return await transform(val);
        });
    }

    pipe<U = T>(
        ...operators: Array<(source: PromptRedactionObservable<any>) => PromptRedactionObservable<any>>
    ): PromptRedactionObservable<U> {
        return operators.reduce(
            (prev, fn) => fn(prev),
            this as PromptRedactionObservable<any>
        ) as PromptRedactionObservable<U>;
    }

    chain<R = any>(
        endpoint: ChatEndpointLike,
        chatOptions: Record<string, any> = {}
    ): PromptRedactionObservable<R> {
        return new PromptRedactionObservable<R>(async () => {
            const redacted = await this.producer();
            if (typeof redacted === "string") {
                return await endpoint.chat({
                    ...chatOptions,
                    prompt: redacted,
                });
            }
            if (Array.isArray(redacted)) {
                return await endpoint.chat({
                    ...chatOptions,
                    messages: redacted,
                });
            }
            if (
                redacted &&
                typeof redacted === "object" &&
                "redactedText" in (redacted as Record<string, any>)
            ) {
                return await endpoint.chat({
                    ...chatOptions,
                    prompt: (redacted as unknown as RedactPromptResult).redactedText,
                });
            }
            return await endpoint.chat({
                ...chatOptions,
                prompt: String(redacted),
            });
        });
    }

    toPromise(): Promise<T> {
        return this.producer();
    }
}

export class AwsComprehendRedact {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    region: string;
    languageCode: string;
    minScore: number;
    entityTypes: (PiiEntityType | string)[];
    redactionMode: RedactionMode;
    maskCharacter: string;
    maxRetry: number;
    delay: number;

    constructor(options: AwsComprehendOptions = {}) {
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0.5;
        this.entityTypes = options.entityTypes || ["ALL"];
        this.redactionMode = options.redactionMode || "ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || "*";
        this.maxRetry = options.maxRetry || 3;
        this.delay = options.delay || 200;
    }

    private hmac(key: string | Buffer, data: string): Buffer {
        return crypto.createHmac("sha256", key).update(data, "utf8").digest();
    }

    private sha256(data: string): string {
        return crypto.createHash("sha256").update(data, "utf8").digest("hex");
    }

    private buildSignedHeaders(amzTarget: string, payload: string): Record<string, string> {
        const host = `comprehend.${this.region}.amazonaws.com`;
        const contentType = "application/x-amz-json-1.1";
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);

        const canonicalHeadersObj: Record<string, string> = {
            "content-type": contentType,
            host,
            "x-amz-date": amzDate,
            "x-amz-target": amzTarget,
        };
        if (this.sessionToken) {
            canonicalHeadersObj["x-amz-security-token"] = this.sessionToken;
        }

        const sortedHeaderKeys = Object.keys(canonicalHeadersObj).sort();
        const canonicalHeaders = sortedHeaderKeys
            .map((k) => `${k}:${canonicalHeadersObj[k]}\n`)
            .join("");
        const signedHeaders = sortedHeaderKeys.join(";");
        const payloadHash = this.sha256(payload);

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
            this.sha256(canonicalRequest),
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

    async detectPiiEntities(text: string, languageCode?: string): Promise<PiiEntity[]> {
        if (!text) return [];
        const url = `https://comprehend.${this.region}.amazonaws.com/`;
        const payload = JSON.stringify({
            Text: text,
            LanguageCode: languageCode || this.languageCode,
        });
        const headers = this.buildSignedHeaders(
            "Comprehend_20171127.DetectPiiEntities",
            payload
        );

        const response = await retry(
            async () => {
                return await axios.post(url, payload, { headers });
            },
            { maxAttempts: this.maxRetry, delay: this.delay }
        );
        return response.data?.Entities || [];
    }

    async containsPiiEntities(text: string, languageCode?: string): Promise<PiiLabel[]> {
        if (!text) return [];
        const url = `https://comprehend.${this.region}.amazonaws.com/`;
        const payload = JSON.stringify({
            Text: text,
            LanguageCode: languageCode || this.languageCode,
        });
        const headers = this.buildSignedHeaders(
            "Comprehend_20171127.ContainsPiiEntities",
            payload
        );

        const response = await retry(
            async () => {
                return await axios.post(url, payload, { headers });
            },
            { maxAttempts: this.maxRetry, delay: this.delay }
        );
        return response.data?.Labels || [];
    }

    async redactText(
        text: string,
        overrideOptions: Partial<AwsComprehendOptions> = {}
    ): Promise<RedactPromptResult> {
        const minScore = overrideOptions.minScore ?? this.minScore;
        const allowedTypes = overrideOptions.entityTypes || this.entityTypes;
        const mode = overrideOptions.redactionMode || this.redactionMode;
        const maskChar = overrideOptions.maskCharacter || this.maskCharacter;
        const lang = overrideOptions.languageCode || this.languageCode;

        const allEntities = await this.detectPiiEntities(text, lang);
        const filtered = allEntities
            .filter((entity) => {
                const scoreOk = entity.Score >= minScore;
                const typeOk =
                    allowedTypes.includes("ALL") || allowedTypes.includes(entity.Type);
                return scoreOk && typeOk;
            })
            .sort((a, b) => a.BeginOffset - b.BeginOffset);

        if (filtered.length === 0) {
            return {
                originalText: text,
                redactedText: text,
                entities: [],
                redactedCount: 0,
            };
        }

        let redactedText = "";
        let cursor = 0;

        for (const entity of filtered) {
            if (entity.BeginOffset < cursor) {
                continue;
            }
            redactedText += text.slice(cursor, entity.BeginOffset);
            const spanLength = Math.max(1, entity.EndOffset - entity.BeginOffset);
            if (mode === "MASK") {
                redactedText += maskChar.repeat(spanLength);
            } else {
                redactedText += `[${entity.Type}]`;
            }
            cursor = entity.EndOffset;
        }
        redactedText += text.slice(cursor);

        return {
            originalText: text,
            redactedText,
            entities: filtered,
            redactedCount: filtered.length,
        };
    }

    async redactPrompt(
        prompt: string,
        overrideOptions: Partial<AwsComprehendOptions> = {}
    ): Promise<string> {
        const result = await this.redactText(prompt, overrideOptions);
        return result.redactedText;
    }

    async redactMessages<M extends { role: string; content: string }>(
        messages: M[],
        overrideOptions: Partial<AwsComprehendOptions> = {}
    ): Promise<M[]> {
        const redactedMessages: M[] = [];
        for (const msg of messages) {
            const redactedContent = await this.redactPrompt(msg.content, overrideOptions);
            redactedMessages.push({
                ...msg,
                content: redactedContent,
            });
        }
        return redactedMessages;
    }

    observe(
        prompt: string,
        overrideOptions: Partial<AwsComprehendOptions> = {}
    ): PromptRedactionObservable<string> {
        return new PromptRedactionObservable<string>(() =>
            this.redactPrompt(prompt, overrideOptions)
        );
    }

    observeDetailed(
        prompt: string,
        overrideOptions: Partial<AwsComprehendOptions> = {}
    ): PromptRedactionObservable<RedactPromptResult> {
        return new PromptRedactionObservable<RedactPromptResult>(() =>
            this.redactText(prompt, overrideOptions)
        );
    }

    observeMessages<M extends { role: string; content: string }>(
        messages: M[],
        overrideOptions: Partial<AwsComprehendOptions> = {}
    ): PromptRedactionObservable<M[]> {
        return new PromptRedactionObservable<M[]>(() =>
            this.redactMessages(messages, overrideOptions)
        );
    }

    chainWithEndpoint<R = any>(
        prompt: string,
        endpoint: ChatEndpointLike,
        chatOptions: Record<string, any> = {},
        overrideOptions: Partial<AwsComprehendOptions> = {}
    ): PromptRedactionObservable<R> {
        return this.observe(prompt, overrideOptions).chain<R>(endpoint, chatOptions);
    }
}

export { AwsComprehendRedact as ComprehendEndpoint };

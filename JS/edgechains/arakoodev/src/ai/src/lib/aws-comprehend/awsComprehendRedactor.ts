import { createHash, createHmac } from "crypto";

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

export interface ComprehendPiiEntity {
    Type: PiiEntityType;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface ComprehendClient {
    detectPiiEntities(input: {
        Text: string;
        LanguageCode: string;
    }): Promise<{ Entities?: ComprehendPiiEntity[] }>;
}

export interface AwsComprehendClientOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
}

export interface AwsComprehendRedactorOptions extends AwsComprehendClientOptions {
    client?: ComprehendClient;
    languageCode?: string;
    minScore?: number;
    entityTypes?: PiiEntityType[];
    placeholder?: string;
}

export interface RedactOptions {
    languageCode?: string;
    minScore?: number;
    entityTypes?: PiiEntityType[];
    placeholder?: string;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: ComprehendPiiEntity[];
}

export interface Observer<T> {
    next(value: T): void;
    error?(error: unknown): void;
    complete?(): void;
}

export interface ObservableLike<T> {
    subscribe(observer: Observer<T> | ((value: T) => void)): { unsubscribe(): void };
}

type Endpoint<T> = (redactedPrompt: string, result: RedactionResult) => Promise<T> | T;

const SERVICE = "comprehend";
const AWS_TARGET = "Comprehend_20171127.DetectPiiEntities";

export class AwsComprehendClient implements ComprehendClient {
    private accessKeyId: string;
    private secretAccessKey: string;
    private sessionToken?: string;
    private region: string;

    constructor(options: AwsComprehendClientOptions = {}) {
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
    }

    async detectPiiEntities(input: {
        Text: string;
        LanguageCode: string;
    }): Promise<{ Entities?: ComprehendPiiEntity[] }> {
        this.assertCredentials();

        const endpoint = `https://comprehend.${this.region}.amazonaws.com/`;
        const body = JSON.stringify(input);
        const now = new Date();
        const amzDate = toAmzDate(now);
        const dateStamp = amzDate.slice(0, 8);
        const payloadHash = sha256(body);
        const headers: Record<string, string> = {
            "content-type": "application/x-amz-json-1.1",
            host: `comprehend.${this.region}.amazonaws.com`,
            "x-amz-date": amzDate,
            "x-amz-target": AWS_TARGET,
        };

        if (this.sessionToken) headers["x-amz-security-token"] = this.sessionToken;

        const authorization = sign({
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.secretAccessKey,
            region: this.region,
            dateStamp,
            amzDate,
            headers,
            payloadHash,
        });

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { ...headers, authorization },
            body,
        });

        if (!response.ok) {
            throw new Error(`AWS Comprehend request failed with status ${response.status}`);
        }

        return (await response.json()) as { Entities?: ComprehendPiiEntity[] };
    }

    private assertCredentials(): void {
        if (!this.accessKeyId || !this.secretAccessKey) {
            throw new Error(
                "AWS credentials are required. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or pass them to AwsComprehendClient."
            );
        }
    }
}

export class AwsComprehendRedactor {
    private client: ComprehendClient;
    private languageCode: string;
    private minScore: number;
    private entityTypes: PiiEntityType[];
    private placeholder: string;

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.client = options.client || new AwsComprehendClient(options);
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0.5;
        this.entityTypes = options.entityTypes || ["ALL"];
        this.placeholder = options.placeholder || "[REDACTED_${TYPE}]";
    }

    async detect(text: string, options: RedactOptions = {}): Promise<ComprehendPiiEntity[]> {
        const languageCode = options.languageCode || this.languageCode;
        const minScore = options.minScore ?? this.minScore;
        const entityTypes = options.entityTypes || this.entityTypes;
        const response = await this.client.detectPiiEntities({ Text: text, LanguageCode: languageCode });

        return (response.Entities || [])
            .filter((entity) => entity.Score >= minScore)
            .filter((entity) => entityTypes.includes("ALL") || entityTypes.includes(entity.Type))
            .sort((a, b) => a.BeginOffset - b.BeginOffset);
    }

    async redact(text: string, options: RedactOptions = {}): Promise<RedactionResult> {
        const entities = await this.detect(text, options);
        const placeholder = options.placeholder || this.placeholder;
        let redactedText = "";
        let cursor = 0;

        for (const entity of entities) {
            if (entity.BeginOffset < cursor) continue;
            redactedText += text.slice(cursor, entity.BeginOffset);
            redactedText += placeholder.replace("${TYPE}", entity.Type);
            cursor = entity.EndOffset;
        }

        redactedText += text.slice(cursor);
        return { originalText: text, redactedText, entities };
    }

    async chain<T>(text: string, endpoint: Endpoint<T>, options: RedactOptions = {}): Promise<T> {
        const result = await this.redact(text, options);
        return endpoint(result.redactedText, result);
    }

    redactObservable(source: ObservableLike<string>, options: RedactOptions = {}): ObservableLike<RedactionResult> {
        return createObservable<RedactionResult>((observer) => {
            let pending = 0;
            let sourceComplete = false;
            const completeIfIdle = () => {
                if (sourceComplete && pending === 0) observer.complete?.();
            };
            const subscription = source.subscribe({
                next: (value) => {
                    pending += 1;
                    this.redact(value, options)
                        .then((result) => observer.next(result))
                        .catch((error) => observer.error?.(error))
                        .finally(() => {
                            pending -= 1;
                            completeIfIdle();
                        });
                },
                error: (error) => observer.error?.(error),
                complete: () => {
                    sourceComplete = true;
                    completeIfIdle();
                },
            });

            return () => subscription.unsubscribe();
        });
    }
}

export function fromPrompts(prompts: string[]): ObservableLike<string> {
    return createObservable<string>((observer) => {
        for (const prompt of prompts) observer.next(prompt);
        observer.complete?.();
        return () => undefined;
    });
}

function createObservable<T>(
    producer: (observer: Observer<T>) => () => void
): ObservableLike<T> {
    return {
        subscribe(observerOrNext: Observer<T> | ((value: T) => void)) {
            const observer =
                typeof observerOrNext === "function" ? { next: observerOrNext } : observerOrNext;
            let closed = false;
            const unsubscribe = producer({
                next: (value) => {
                    if (!closed) observer.next(value);
                },
                error: (error) => {
                    if (!closed) observer.error?.(error);
                },
                complete: () => {
                    if (!closed) observer.complete?.();
                },
            });

            return {
                unsubscribe() {
                    closed = true;
                    unsubscribe();
                },
            };
        },
    };
}

function sign(input: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    dateStamp: string;
    amzDate: string;
    headers: Record<string, string>;
    payloadHash: string;
}): string {
    const signedHeaders = Object.keys(input.headers).sort().join(";");
    const canonicalHeaders = Object.keys(input.headers)
        .sort()
        .map((key) => `${key}:${input.headers[key].trim()}\n`)
        .join("");
    const canonicalRequest = [
        "POST",
        "/",
        "",
        canonicalHeaders,
        signedHeaders,
        input.payloadHash,
    ].join("\n");
    const credentialScope = `${input.dateStamp}/${input.region}/${SERVICE}/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        input.amzDate,
        credentialScope,
        sha256(canonicalRequest),
    ].join("\n");
    const signingKey = getSigningKey(input.secretAccessKey, input.dateStamp, input.region);
    const signature = hmacHex(signingKey, stringToSign);

    return [
        "AWS4-HMAC-SHA256",
        `Credential=${input.accessKeyId}/${credentialScope}`,
        `SignedHeaders=${signedHeaders}`,
        `Signature=${signature}`,
    ].join(", ");
}

function getSigningKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
    const dateKey = hmac(Buffer.from(`AWS4${secretAccessKey}`, "utf8"), dateStamp);
    const dateRegionKey = hmac(dateKey, region);
    const dateRegionServiceKey = hmac(dateRegionKey, SERVICE);
    return hmac(dateRegionServiceKey, "aws4_request");
}

function toAmzDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer, value: string): Buffer {
    return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key: Buffer, value: string): string {
    return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

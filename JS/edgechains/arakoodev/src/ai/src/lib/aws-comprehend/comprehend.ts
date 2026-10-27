import axios from "axios";
import crypto from "crypto";

export interface AwsComprehendOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
    endpoint?: string;
    languageCode?: string;
    minConfidence?: number;
}

export interface PiiEntity {
    Type: string;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface PiiLabel {
    Name: string;
    Score: number;
}

export interface RedactPiiOptions {
    languageCode?: string;
    minConfidence?: number;
    entityTypes?: string[];
    maskMode?: "ENTITY_TYPE" | "MASK";
    maskCharacter?: string;
}

export interface RedactPiiResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
}

export interface Subscribable<T> {
    subscribe(
        observerOrNext?:
            | {
                  next?: (value: T) => void;
                  error?: (err: any) => void;
                  complete?: () => void;
              }
            | ((value: T) => void),
        error?: (err: any) => void,
        complete?: () => void
    ): { unsubscribe: () => void };
    pipe<R>(fn: (input: T) => R | Promise<R>): Subscribable<R>;
    toPromise(): Promise<T>;
}

function createObservable<T>(producer: () => Promise<T>): Subscribable<T> {
    return {
        subscribe(observerOrNext, errorFn, completeFn) {
            let unsubscribed = false;
            const next =
                typeof observerOrNext === "function"
                    ? observerOrNext
                    : observerOrNext?.next?.bind(observerOrNext);
            const error =
                typeof observerOrNext === "function"
                    ? errorFn
                    : observerOrNext?.error?.bind(observerOrNext);
            const complete =
                typeof observerOrNext === "function"
                    ? completeFn
                    : observerOrNext?.complete?.bind(observerOrNext);

            producer()
                .then((val) => {
                    if (!unsubscribed) {
                        next?.(val);
                        complete?.();
                    }
                })
                .catch((err) => {
                    if (!unsubscribed) {
                        error?.(err);
                    }
                });

            return {
                unsubscribe() {
                    unsubscribed = true;
                },
            };
        },
        pipe<R>(fn: (input: T) => R | Promise<R>): Subscribable<R> {
            return createObservable(async () => {
                const value = await producer();
                return await fn(value);
            });
        },
        toPromise() {
            return producer();
        },
    };
}

export class AwsComprehend {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    region: string;
    endpoint: string;
    languageCode: string;
    minConfidence: number;

    constructor(options: AwsComprehendOptions = {}) {
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.endpoint = options.endpoint || `https://comprehend.${this.region}.amazonaws.com/`;
        this.languageCode = options.languageCode || "en";
        this.minConfidence = options.minConfidence ?? 0.5;
    }

    private sha256(data: string): string {
        return crypto.createHash("sha256").update(data, "utf8").digest("hex");
    }

    private hmac(key: string | Buffer, data: string): Buffer {
        return crypto.createHmac("sha256", key).update(data, "utf8").digest();
    }

    private buildSignedHeaders(target: string, bodyJson: string, now: Date = new Date()): Record<string, string> {
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const url = new URL(this.endpoint);
        const host = url.host;
        const contentType = "application/x-amz-json-1.1";
        const payloadHash = this.sha256(bodyJson);

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
        const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${canonicalHeadersMap[k]}\n`).join("");
        const signedHeaders = sortedHeaderKeys.join(";");

        const canonicalRequest = [
            "POST",
            url.pathname || "/",
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
            this.sha256(canonicalRequest),
        ].join("\n");

        const kDate = this.hmac(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = this.hmac(kDate, this.region);
        const kService = this.hmac(kRegion, "comprehend");
        const kSigning = this.hmac(kService, "aws4_request");
        const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

        const authorizationHeader =
            `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, ` +
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

    async detectPiiEntities(text: string, languageCode?: string): Promise<PiiEntity[]> {
        const bodyJson = JSON.stringify({
            Text: text,
            LanguageCode: languageCode || this.languageCode,
        });
        const target = "Comprehend_20171127.DetectPiiEntities";
        const headers = this.buildSignedHeaders(target, bodyJson);

        const response = await axios.post(this.endpoint, bodyJson, { headers });
        return response.data?.Entities || [];
    }

    async containsPiiEntities(text: string, languageCode?: string): Promise<PiiLabel[]> {
        const bodyJson = JSON.stringify({
            Text: text,
            LanguageCode: languageCode || this.languageCode,
        });
        const target = "Comprehend_20171127.ContainsPiiEntities";
        const headers = this.buildSignedHeaders(target, bodyJson);

        const response = await axios.post(this.endpoint, bodyJson, { headers });
        return response.data?.Labels || [];
    }

    async redactPii(text: string, options: RedactPiiOptions = {}): Promise<RedactPiiResult> {
        const entities = await this.detectPiiEntities(text, options.languageCode);
        const minConfidence = options.minConfidence ?? this.minConfidence;
        const allowedTypes = options.entityTypes ? new Set(options.entityTypes) : null;
        const maskMode = options.maskMode || "ENTITY_TYPE";
        const maskChar = options.maskCharacter || "*";

        const filtered = entities
            .filter((e) => e.Score >= minConfidence && (!allowedTypes || allowedTypes.has(e.Type)))
            .sort((a, b) => b.BeginOffset - a.BeginOffset);

        let redactedText = text;
        for (const entity of filtered) {
            const replacement =
                maskMode === "MASK"
                    ? maskChar.repeat(Math.max(1, entity.EndOffset - entity.BeginOffset))
                    : `[${entity.Type}]`;
            redactedText =
                redactedText.slice(0, entity.BeginOffset) +
                replacement +
                redactedText.slice(entity.EndOffset);
        }

        return {
            originalText: text,
            redactedText,
            entities: filtered.reverse(),
        };
    }

    redactObservable(text: string, options: RedactPiiOptions = {}): Subscribable<RedactPiiResult> {
        return createObservable(() => this.redactPii(text, options));
    }

    chainWithEndpoint<T>(
        prompt: string,
        endpointCall: (redactedPrompt: string) => T | Promise<T>,
        options: RedactPiiOptions = {}
    ): Subscribable<T> {
        return this.redactObservable(prompt, options).pipe((res) => endpointCall(res.redactedText));
    }
}

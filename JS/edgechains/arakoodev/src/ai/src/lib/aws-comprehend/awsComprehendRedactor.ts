import crypto from "node:crypto";

export type PiiEntityType =
    | "EMAIL"
    | "PHONE"
    | "SSN"
    | "CREDIT_DEBIT_NUMBER"
    | "BANK_ACCOUNT_NUMBER"
    | "AWS_ACCESS_KEY"
    | "AWS_SECRET_KEY"
    | "IP_ADDRESS"
    | "NAME"
    | "ADDRESS"
    | "PASSPORT_NUMBER"
    | "DRIVER_ID"
    | string;

export interface PiiEntity {
    Type: PiiEntityType;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface ComprehendDetectPiiResponse {
    Entities: PiiEntity[];
}

export interface ComprehendTransport {
    detectPiiEntities(text: string, languageCode: string): Promise<ComprehendDetectPiiResponse>;
}

export interface AWSComprehendRedactorOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    languageCode?: string;
    minConfidence?: number;
    redactTypes?: PiiEntityType[];
    maskFormat?: (entity: PiiEntity, originalText: string) => string;
    transport?: ComprehendTransport;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
    redactedCount: number;
}

export interface EndpointLike {
    chat?: (options: { prompt: string; [key: string]: unknown }) => Promise<unknown>;
    makeRequest?: (options: { prompt: string; [key: string]: unknown }) => Promise<unknown>;
}

function hmacSha256(key: crypto.BinaryLike, data: string): Buffer {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Lightweight AWS SigV4 HTTP transport for Amazon Comprehend DetectPiiEntities
 * using Node's built-in crypto and fetch (zero external AWS SDK bloat).
 */
export class AwsSigV4ComprehendTransport implements ComprehendTransport {
    private readonly region: string;
    private readonly accessKeyId: string;
    private readonly secretAccessKey: string;
    private readonly sessionToken?: string;

    constructor(opts: {
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    }) {
        this.region = opts.region;
        this.accessKeyId = opts.accessKeyId;
        this.secretAccessKey = opts.secretAccessKey;
        this.sessionToken = opts.sessionToken;
    }

    async detectPiiEntities(text: string, languageCode: string): Promise<ComprehendDetectPiiResponse> {
        const service = "comprehend";
        const host = `${service}.${this.region}.amazonaws.com`;
        const endpoint = `https://${host}/`;
        const target = "Comprehend_20171127.DetectPiiEntities";
        const body = JSON.stringify({ Text: text, LanguageCode: languageCode });

        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const payloadHash = sha256Hex(body);

        const canonicalHeadersMap: Record<string, string> = {
            "content-type": "application/x-amz-json-1.1",
            host,
            "x-amz-date": amzDate,
            "x-amz-target": target,
        };
        if (this.sessionToken) {
            canonicalHeadersMap["x-amz-security-token"] = this.sessionToken;
        }

        const signedHeaderKeys = Object.keys(canonicalHeadersMap).sort();
        const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${canonicalHeadersMap[k]}\n`).join("");
        const signedHeaders = signedHeaderKeys.join(";");

        const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
        const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
        const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

        const kDate = hmacSha256(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = hmacSha256(kDate, this.region);
        const kService = hmacSha256(kRegion, service);
        const kSigning = hmacSha256(kService, "aws4_request");
        const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

        const authHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const resp = await fetch(endpoint, {
            method: "POST",
            headers: {
                ...canonicalHeadersMap,
                Authorization: authHeader,
            },
            body,
        });
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`AWS Comprehend DetectPiiEntities failed (${resp.status}): ${errText}`);
        }
        return (await resp.json()) as ComprehendDetectPiiResponse;
    }
}

/**
 * Observable-style chainable pipeline wrapper so AWSComprehendRedactor
 * composes cleanly with EdgeChains Endpoint classes (OpenAI, GeminiAI, LlamaAI).
 */
export class RedactionObservable<T> {
    private readonly producer: () => Promise<T>;

    constructor(producer: () => Promise<T>) {
        this.producer = producer;
    }

    pipe<R>(operator: (value: T) => Promise<R> | R): RedactionObservable<R> {
        return new RedactionObservable<R>(async () => {
            const val = await this.producer();
            return await operator(val);
        });
    }

    subscribe(
        onNext: (value: T) => void,
        onError?: (err: unknown) => void,
        onComplete?: () => void
    ): Promise<void> {
        return this.producer()
            .then((val) => {
                onNext(val);
                if (onComplete) onComplete();
            })
            .catch((err) => {
                if (onError) onError(err);
                else throw err;
            });
    }

    toPromise(): Promise<T> {
        return this.producer();
    }
}

/**
 * Utility class integrating Amazon Comprehend PII Detection & Redaction
 * for EdgeChains JS/TS prompt pipelines.
 */
export class AWSComprehendRedactor {
    private readonly region: string;
    private readonly languageCode: string;
    private readonly minConfidence: number;
    private readonly redactTypes?: Set<PiiEntityType>;
    private readonly maskFormat: (entity: PiiEntity, originalText: string) => string;
    private readonly transport: ComprehendTransport;

    constructor(options: AWSComprehendRedactorOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.languageCode = options.languageCode || "en";
        this.minConfidence = options.minConfidence ?? 0.7;
        this.redactTypes = options.redactTypes ? new Set(options.redactTypes) : undefined;
        this.maskFormat = options.maskFormat || ((entity) => `[REDACTED_${entity.Type}]`);

        if (options.transport) {
            this.transport = options.transport;
        } else {
            const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
            const secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
            const sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
            if (!accessKeyId || !secretAccessKey) {
                throw new Error(
                    "AWSComprehendRedactor requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (or a custom transport)."
                );
            }
            this.transport = new AwsSigV4ComprehendTransport({
                region: this.region,
                accessKeyId,
                secretAccessKey,
                sessionToken,
            });
        }
    }

    async redact(text: string): Promise<RedactionResult> {
        if (!text || text.trim() === "") {
            return { originalText: text, redactedText: text, entities: [], redactedCount: 0 };
        }
        const response = await this.transport.detectPiiEntities(text, this.languageCode);
        const filtered = (response.Entities || [])
            .filter((e) => e.Score >= this.minConfidence)
            .filter((e) => !this.redactTypes || this.redactTypes.has(e.Type))
            .filter((e) => e.BeginOffset >= 0 && e.EndOffset <= text.length && e.BeginOffset < e.EndOffset)
            .sort((a, b) => b.BeginOffset - a.BeginOffset);

        // Apply replacements from right to left so earlier offsets remain valid
        let redacted = text;
        let lastAppliedStart = Number.POSITIVE_INFINITY;
        const applied: PiiEntity[] = [];

        for (const entity of filtered) {
            if (entity.EndOffset > lastAppliedStart) {
                // Skip overlapping span already covered by a higher-offset entity
                continue;
            }
            const originalSlice = text.slice(entity.BeginOffset, entity.EndOffset);
            const replacement = this.maskFormat(entity, originalSlice);
            redacted = redacted.slice(0, entity.BeginOffset) + replacement + redacted.slice(entity.EndOffset);
            lastAppliedStart = entity.BeginOffset;
            applied.push(entity);
        }

        applied.reverse();
        return {
            originalText: text,
            redactedText: redacted,
            entities: applied,
            redactedCount: applied.length,
        };
    }

    /**
     * Returns an observable stream that redacts the prompt and can be piped
     * directly into any EdgeChains Endpoint (`OpenAI`, `GeminiAI`, `LlamaAI`).
     */
    redactAsObservable(prompt: string): RedactionObservable<RedactionResult> {
        return new RedactionObservable(() => this.redact(prompt));
    }

    /**
     * Convenience helper that chains PII redaction directly into an EdgeChains Endpoint.
     */
    chainWithEndpoint<TResp = unknown>(
        prompt: string,
        endpoint: EndpointLike,
        extraOptions: Record<string, unknown> = {}
    ): RedactionObservable<{ redaction: RedactionResult; response: TResp }> {
        return this.redactAsObservable(prompt).pipe(async (redaction) => {
            const payload = { ...extraOptions, prompt: redaction.redactedText };
            if (typeof endpoint.chat === "function") {
                const response = (await endpoint.chat(payload)) as TResp;
                return { redaction, response };
            }
            if (typeof endpoint.makeRequest === "function") {
                const response = (await endpoint.makeRequest(payload)) as TResp;
                return { redaction, response };
            }
            throw new Error("Provided endpoint must implement chat() or makeRequest().");
        });
    }
}

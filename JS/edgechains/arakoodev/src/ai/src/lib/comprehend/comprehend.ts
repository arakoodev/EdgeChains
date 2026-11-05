import axios from "axios";
import { createHash, createHmac } from "crypto";

/**
 * A PII entity as returned by AWS Comprehend DetectPiiEntities.
 * BeginOffset/EndOffset are character offsets into the source text.
 */
export interface PiiEntity {
    BeginOffset: number;
    EndOffset: number;
    Type: string;
    Score: number;
}

export interface RedactionResult {
    redactedText: string;
    entities: PiiEntity[];
}

export interface RedactionEvent {
    original: string;
    redactedText: string;
    entities: PiiEntity[];
}

/** Injectable detection hook. Lets tests (and custom backends) run without AWS credentials. */
export type DetectPiiEntities = (text: string) => Promise<PiiEntity[]>;

interface ComprehendRedactorOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    /** Language of the input text, default "en". */
    languageCode?: string;
    /** Only redact these entity types (e.g. ["EMAIL", "SSN"]). Defaults to every detected type. */
    entityTypes?: string[];
    /** Ignore entities detected below this confidence, 0..1. Default 0. */
    minConfidence?: number;
    /** Mask pattern, "{TYPE}" is replaced by the entity type. Default "[REDACTED_{TYPE}]". */
    maskTemplate?: string;
    /** Per-type mask overrides, e.g. { SSN: "[REDACTED_SSN]" }. */
    masks?: Record<string, string>;
    /** "aws" calls AWS Comprehend, "offline" uses deterministic local detection. Auto-selected from credentials when omitted. */
    mode?: "aws" | "offline";
    /** Custom detector (mock/offline backends). Takes precedence over aws/offline modes. */
    detectPiiEntities?: DetectPiiEntities;
}

const DEFAULT_MASK_TEMPLATE = "[REDACTED_{TYPE}]";

// Deterministic offline patterns, applied in order: first match wins on overlap.
const OFFLINE_PATTERNS: Array<[RegExp, string]> = [
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "EMAIL"],
    [/https?:\/\/[^\s<>"']+/g, "URL"],
    [/\b\d{3}-\d{2}-\d{4}\b/g, "SSN"],
    [/\b(?:\d[ -]?){13,16}\b/g, "CREDIT_DEBIT_NUMBER"],
    [/(?:\+\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]?\d{4}\b/g, "PHONE"],
    [/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, "DATE"],
    [
        /\b\d{1,5}\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b\.?/g,
        "ADDRESS",
    ],
    [/\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g, "NAME"],
];

const sha256Hex = (data: string): string =>
    createHash("sha256").update(data, "utf-8").digest("hex");
const hmac = (key: Buffer | string, data: string): Buffer =>
    createHmac("sha256", key).update(data, "utf-8").digest();

export class ComprehendRedactor {
    private region: string;
    private accessKeyId: string;
    private secretAccessKey: string;
    private sessionToken: string;
    private languageCode: string;
    private entityTypes?: string[];
    private minConfidence: number;
    private maskTemplate: string;
    private masks: Record<string, string>;
    private mode: "aws" | "offline";
    private detectOverride?: DetectPiiEntities;

    constructor(options: ComprehendRedactorOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN || "";
        this.languageCode = options.languageCode || "en";
        this.entityTypes = options.entityTypes;
        this.minConfidence = options.minConfidence ?? 0;
        this.maskTemplate = options.maskTemplate || DEFAULT_MASK_TEMPLATE;
        this.masks = options.masks || {};
        this.detectOverride = options.detectPiiEntities;
        this.mode =
            options.mode ||
            (this.detectOverride || (this.accessKeyId && this.secretAccessKey && this.region)
                ? "aws"
                : "offline");
        if (this.mode === "aws" && !this.detectOverride) {
            if (!this.accessKeyId || !this.secretAccessKey || !this.region) {
                throw new Error(
                    "ComprehendRedactor: AWS credentials missing. Pass accessKeyId/secretAccessKey/region " +
                        '(or set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_REGION), or use mode: "offline".'
                );
            }
        }
    }

    /** Lightweight pre-flight check backed by the Comprehend ContainsPiiEntities action in aws mode. */
    async containsPii(text: string): Promise<boolean> {
        if (!text) return false;
        if (this.mode === "aws" && !this.detectOverride) {
            const data = await this.callComprehend("ContainsPiiEntities", {
                Text: text,
                LanguageCode: this.languageCode,
            });
            const entities: PiiEntity[] = (data.PiiEntities || []).map((e: any) => ({
                BeginOffset: -1,
                EndOffset: -1,
                Type: e.Type,
                Score: e.Score,
            }));
            return this.filter(entities).length > 0;
        }
        return (await this.detect(text)).length > 0;
    }

    /** Detect PII entities (filtered by entityTypes/minConfidence), sorted by BeginOffset. */
    async detect(text: string): Promise<PiiEntity[]> {
        if (!text) return [];
        let entities: PiiEntity[];
        if (this.detectOverride) {
            entities = await this.detectOverride(text);
        } else if (this.mode === "aws") {
            const data = await this.callComprehend("DetectPiiEntities", {
                Text: text,
                LanguageCode: this.languageCode,
            });
            entities = data.Entities || [];
        } else {
            entities = ComprehendRedactor.detectOffline(text);
        }
        return this.filter(entities).sort((a, b) => a.BeginOffset - b.BeginOffset);
    }

    /** Detect PII entities and replace each one with its configured mask. */
    async redact(text: string): Promise<RedactionResult> {
        if (!text) return { redactedText: text ?? "", entities: [] };
        const entities = await this.detect(text);
        return {
            redactedText: ComprehendRedactor.applyMasks(text, entities, this.mask.bind(this)),
            entities,
        };
    }

    private filter(entities: PiiEntity[]): PiiEntity[] {
        return entities.filter(
            (e) =>
                e.Score >= this.minConfidence &&
                (!this.entityTypes || this.entityTypes.includes(e.Type))
        );
    }

    private mask(type: string): string {
        return this.masks[type] ?? this.maskTemplate.split("{TYPE}").join(type);
    }

    private static applyMasks(
        text: string,
        entities: PiiEntity[],
        maskOf: (type: string) => string
    ): string {
        // shortcut: offsets are treated as UTF-16 string indexes; upgrade if non-BMP PII must round-trip exactly.
        // Walk right-to-left so earlier offsets stay valid; overlapping entities are dropped (first one wins).
        let out = text;
        let coveredFrom = Infinity;
        for (let i = entities.length - 1; i >= 0; i--) {
            const e = entities[i];
            if (e.EndOffset > coveredFrom) continue;
            out = out.slice(0, e.BeginOffset) + maskOf(e.Type) + out.slice(e.EndOffset);
            coveredFrom = e.BeginOffset;
        }
        return out;
    }

    private static detectOffline(text: string): PiiEntity[] {
        const entities: PiiEntity[] = [];
        for (const [pattern, type] of OFFLINE_PATTERNS) {
            const re = new RegExp(pattern.source, pattern.flags);
            let match: RegExpExecArray | null;
            while ((match = re.exec(text)) !== null) {
                if (match[0].length === 0) continue;
                const start = match.index;
                const end = start + match[0].length;
                if (entities.some((e) => start < e.EndOffset && end > e.BeginOffset)) continue;
                entities.push({ BeginOffset: start, EndOffset: end, Type: type, Score: 1 });
            }
        }
        return entities.sort((a, b) => a.BeginOffset - b.BeginOffset);
    }

    // shortcut: Comprehend DetectPiiEntities accepts ~100k chars; chunk the text if longer prompts are expected.
    private async callComprehend(action: string, body: Record<string, unknown>): Promise<any> {
        const host = `comprehend.${this.region}.amazonaws.com`;
        const payload = JSON.stringify(body);
        const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const headers: Record<string, string> = {
            "content-type": "application/x-amz-json-1.1",
            host: host,
            "x-amz-date": amzDate,
            "x-amz-target": `Comprehend_20171013.${action}`,
            "x-amz-content-sha256": sha256Hex(payload),
        };
        if (this.sessionToken) headers["x-amz-security-token"] = this.sessionToken;
        const signedHeaders = Object.keys(headers).sort();
        const canonicalRequest = [
            "POST",
            "/",
            "",
            signedHeaders.map((h) => `${h}:${headers[h].trim()}\n`).join(""),
            signedHeaders.join(";"),
            headers["x-amz-content-sha256"],
        ].join("\n");
        const scope = `${dateStamp}/${this.region}/comprehend/aws4_request`;
        const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join(
            "\n"
        );
        let signingKey: Buffer | string = "AWS4" + this.secretAccessKey;
        for (const part of [dateStamp, this.region, "comprehend", "aws4_request"]) {
            signingKey = hmac(signingKey, part);
        }
        const signature = hmac(signingKey, stringToSign).toString("hex");
        headers["authorization"] =
            `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, ` +
            `SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
        const response = await axios.post(`https://${host}/`, payload, { headers });
        return response.data;
    }
}

/** Minimal shape of an EdgeChains LLM endpoint (matches the OpenAI/Gemini/Llama classes in this SDK). */
export interface LlmEndpointLike {
    chat(options: any): Promise<any>;
}

/**
 * Chains with EdgeChains endpoint classes as an observable middleware: PII is redacted
 * from prompts/messages before they are dispatched to the downstream LLM endpoint.
 */
export class PiiRedactEndpoint {
    private listeners = new Set<(event: RedactionEvent) => void>();

    constructor(
        private redactor: ComprehendRedactor,
        private next?: LlmEndpointLike | ((redactedPrompt: string) => Promise<any>)
    ) {}

    /** Subscribe to every redaction performed by this endpoint. Returns an unsubscribe handle. */
    subscribe(listener: (event: RedactionEvent) => void): { unsubscribe(): void } {
        this.listeners.add(listener);
        return { unsubscribe: () => this.listeners.delete(listener) };
    }

    /** Redact prompt/messages, emit observable events, then dispatch to the chained endpoint. */
    async chat(chatOptions: any): Promise<any> {
        const options = { ...chatOptions };
        const redactField = async (content: string): Promise<string> => {
            const result = await this.redactor.redact(content);
            if (result.entities.length > 0) {
                for (const listener of this.listeners) {
                    listener({
                        original: content,
                        redactedText: result.redactedText,
                        entities: result.entities,
                    });
                }
            }
            return result.redactedText;
        };
        if (typeof options.prompt === "string") {
            options.prompt = await redactField(options.prompt);
        }
        if (Array.isArray(options.messages)) {
            options.messages = await Promise.all(
                options.messages.map(async (m: any) => ({
                    ...m,
                    content:
                        typeof m.content === "string" ? await redactField(m.content) : m.content,
                }))
            );
        }
        if (!this.next) return options;
        if (typeof this.next === "function") return this.next(options.prompt ?? "");
        return this.next.chat(options);
    }

    /**
     * Observable pass-through for stream-based chaining: pipe a ReadableStream<string> of
     * prompt text through this transform to get PII-redacted text before LLM dispatch.
     */
    pipe(): TransformStream<string, string> {
        // shortcut: buffers until flush because PII spans chunk boundaries; move to a sliding window for incremental output.
        let buffer = "";
        const redactor = this.redactor;
        const emit = (event: RedactionEvent) => {
            for (const listener of this.listeners) listener(event);
        };
        return new TransformStream<string, string>({
            transform(chunk, controller) {
                buffer += chunk;
            },
            async flush(controller) {
                if (!buffer) return;
                const result = await redactor.redact(buffer);
                if (result.entities.length > 0) {
                    emit({
                        original: buffer,
                        redactedText: result.redactedText,
                        entities: result.entities,
                    });
                }
                controller.enqueue(result.redactedText);
            },
        });
    }
}

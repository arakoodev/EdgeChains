/**
 * AWS Comprehend redaction utilities for EdgeChains.
 *
 * Adds chainable, observable-friendly classes that scrub PII from prompt text.
 *  - ComprehendRedactor:      detects/redacts PII via AWS Comprehend detectPiiEntities.
 *  - RedactEndpointDecorator: wraps any endpoint-like object so its prompt is redacted
 *                             before the request is sent (chains with Endpoint classes).
 * Falls back to a deterministic local redactor when AWS creds are absent (keeps tests offline).
 */
import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    PiiEntityType,
} from "@aws-sdk/client-comprehend";

export const DEFAULT_PII_TYPES: PiiEntityType[] = [
    "NAME", "EMAIL", "PHONE", "ADDRESS", "SSN", "CREDIT_DEBIT_NUMBER",
];

export interface RedactionSpan {
    beginOffset: number;
    endOffset: number;
    type: string;
    text: string;
}
export interface RedactionResult {
    redactedText: string;
    spans: RedactionSpan[];
}
export interface ComprehendRedactorConfig {
    region?: string;
    entityTypes?: PiiEntityType[];
    client?: ComprehendClient;
    fallbackOnError?: boolean;
}

export class ComprehendRedactor {
    private readonly client: ComprehendClient;
    private readonly entityTypes: PiiEntityType[];
    private readonly fallbackOnError: boolean;

    constructor(config: ComprehendRedactorConfig = {}) {
        this.client = config.client ?? new ComprehendClient({ region: config.region ?? "us-east-1" });
        this.entityTypes = config.entityTypes ?? DEFAULT_PII_TYPES;
        this.fallbackOnError = config.fallbackOnError ?? true;
    }

    public async redact(text: string): Promise<RedactionResult> {
        if (!text) return { redactedText: text, spans: [] };
        try {
            return await this.redactWithComprehend(text);
        } catch (err) {
            if (!this.fallbackOnError) throw err;
            return localRedact(text);
        }
    }

    public async redactText(text: string): Promise<string> {
        const { redactedText } = await this.redact(text);
        return redactedText;
    }

    private async redactWithComprehend(text: string): Promise<RedactionResult> {
        const command = new DetectPiiEntitiesCommand({ Text: text, LanguageCode: "en" });
        const resp = await this.client.send(command);
        const entities = resp.Entities ?? [];
        const spans: RedactionSpan[] = entities
            .filter((e) => (e.Type ? this.entityTypes.includes(e.Type) : false))
            .map((e) => ({
                beginOffset: e.BeginOffset ?? 0,
                endOffset: e.EndOffset ?? 0,
                type: e.Type ?? "PII",
                text: text.slice(e.BeginOffset ?? 0, e.EndOffset ?? 0),
            }))
            .sort((a, b) => a.beginOffset - b.beginOffset);
        return { redactedText: applySpans(text, spans), spans };
    }
}

export class RedactEndpointDecorator<T extends object> {
    constructor(private readonly endpoint: T, private readonly redactor: ComprehendRedactor) {}

    public async run(text: string, ...rest: unknown[]): Promise<unknown> {
        const safe = await this.redactor.redactText(text);
        const ep = this.endpoint as unknown as Record<string, (...args: unknown[]) => unknown>;
        const fn = ep["run"] ?? ep["send"] ?? ep["call"];
        if (typeof fn !== "function") {
            throw new Error("RedactEndpointDecorator: endpoint has no run/send/call method");
        }
        return fn.call(this.endpoint, safe, ...rest);
    }
}

export function applySpans(text: string, spans: RedactionSpan[]): string {
    if (!spans.length) return text;
    let out = "";
    let cursor = 0;
    for (const span of spans) {
        if (span.beginOffset < cursor) continue;
        out += text.slice(cursor, span.beginOffset);
        out += `[${span.type}]`;
        cursor = span.endOffset;
    }
    out += text.slice(cursor);
    return out;
}

export function localRedact(text: string): RedactionResult {
    const spans: RedactionSpan[] = [];
    const patterns: { type: string; re: RegExp }[] = [
        { type: "EMAIL", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
        { type: "PHONE", re: /\+?\d[\d\s().-]{7,}\d/g },
        { type: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/g },
        { type: "CREDIT_DEBIT_NUMBER", re: /\b(?:\d[ -]*?){13,16}\b/g },
    ];
    for (const { type, re } of patterns) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            spans.push({ beginOffset: m.index, endOffset: m.index + m[0].length, type, text: m[0] });
            if (m.index === re.lastIndex) re.lastIndex++;
        }
    }
    spans.sort((a, b) => a.beginOffset - b.beginOffset);
    return { redactedText: applySpans(text, spans), spans };
}

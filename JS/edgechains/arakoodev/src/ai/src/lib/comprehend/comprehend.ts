import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { defer, type Observable, type OperatorFunction, concatMap } from "rxjs";

export interface PiiSpan {
    BeginOffset?: number;
    EndOffset?: number;
}

export interface PiiDetector {
    detect(text: string, language: "en" | "es"): Promise<readonly PiiSpan[]>;
}

export interface RedactorOptions {
    region?: string;
    language?: "en" | "es";
    replacement?: string;
    detector?: PiiDetector;
}

/** AWS offsets count Unicode code points; JavaScript string offsets count UTF-16 units. */
export function redactSpans(text: string, spans: readonly PiiSpan[], replacement: string): string {
    const chars = Array.from(text);
    const ranges = spans.map(({ BeginOffset: start, EndOffset: end }) => {
        if (!Number.isInteger(start) || !Number.isInteger(end) ||
            start! < 0 || end! <= start! || end! > chars.length) {
            // Fail closed: never pass original text to the next endpoint on bad detections.
            throw new Error("Comprehend returned invalid PII offsets");
        }
        return { start: start!, end: end! };
    }).sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: { start: number; end: number }[] = [];
    for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (last && range.start < last.end) last.end = Math.max(last.end, range.end);
        else merged.push({ ...range });
    }
    let result = "";
    let cursor = 0;
    for (const range of merged) {
        result += chars.slice(cursor, range.start).join("") + replacement;
        cursor = range.end;
    }
    return result + chars.slice(cursor).join("");
}

export interface TextChatOptions {
    prompt?: string;
    messages?: { role: string; content: string }[];
}

export class ComprehendPiiRedactor {
    private readonly detector: PiiDetector;
    private readonly language: "en" | "es";
    private readonly replacement: string;

    constructor(options: RedactorOptions = {}) {
        this.language = options.language ?? "en";
        this.replacement = options.replacement ?? "[REDACTED]";
        if (options.detector) this.detector = options.detector;
        else {
            const client = new ComprehendClient({ region: options.region });
            this.detector = {
                async detect(text, language) {
                    const response = await client.send(new DetectPiiEntitiesCommand({
                        Text: text, LanguageCode: language,
                    }));
                    if (!Array.isArray(response.Entities)) {
                        throw new Error("Comprehend response omitted PII detections");
                    }
                    return response.Entities;
                },
            };
        }
    }

    async redact(text: string): Promise<string> {
        if (text.length === 0) return text;
        // Reject rather than split: splitting could hide a PII span crossing a chunk boundary.
        if (Buffer.byteLength(text, "utf8") > 100_000) {
            throw new Error("Comprehend PII input exceeds 100,000 UTF-8 bytes");
        }
        return redactSpans(text, await this.detector.detect(text, this.language), this.replacement);
    }

    /** Lazy subscription; no detection request before subscribe(). */
    observe(text: string): Observable<string> {
        return defer(() => this.redact(text));
    }

    operator(): OperatorFunction<string, string> {
        return concatMap((text) => this.observe(text));
    }

    /** Decorates existing chat endpoints without mutating caller-owned options. */
    next<T extends TextChatOptions, R>(endpoint: { chat(options: T): Promise<R> }) {
        return {
            chat: async (options: T): Promise<R> => {
                const clean = { ...options };
                if (options.prompt !== undefined) clean.prompt = await this.redact(options.prompt);
                if (options.messages !== undefined) {
                    clean.messages = await Promise.all(options.messages.map(async (message) => ({
                        ...message, content: await this.redact(message.content),
                    })));
                }
                return endpoint.chat(clean);
            },
        };
    }
}

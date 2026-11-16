import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type LanguageCode,
} from "@aws-sdk/client-comprehend";

export interface RedactOptions {
    /** Language of the text. Defaults to "en". */
    languageCode?: LanguageCode;
    /** Only redact these PII types (e.g. ["EMAIL", "SSN"]). Redacts all detected types when omitted. */
    entityTypes?: string[];
    /** Replacement for each span. Defaults to "[TYPE]". A function receives the entity type and original text. */
    mask?: string | ((type: string, original: string) => string);
}

export interface RedactedEntity {
    type: string;
    score?: number;
    /** Offsets into the original text (in characters, i.e. Unicode code points, as returned by Comprehend). */
    start: number;
    end: number;
    text: string;
}

export interface RedactResult {
    redacted: string;
    entities: RedactedEntity[];
}

export interface ComprehendRedactorOptions {
    region?: string;
    /** Inject a preconfigured client (useful for custom credentials and for tests). */
    client?: Pick<ComprehendClient, "send">;
}

/** Detects PII with AWS Comprehend and masks it in text, e.g. before a prompt is sent to an LLM endpoint. */
export class ComprehendRedactor {
    private client: Pick<ComprehendClient, "send">;

    constructor(options: ComprehendRedactorOptions = {}) {
        this.client = options.client ?? new ComprehendClient({ region: options.region });
    }

    async redact(text: string, options: RedactOptions = {}): Promise<RedactResult> {
        if (!text) return { redacted: text ?? "", entities: [] };
        const { languageCode = "en", entityTypes, mask = (type: string) => `[${type}]` } = options;

        const response = await this.client.send(
            new DetectPiiEntitiesCommand({ Text: text, LanguageCode: languageCode }),
        );

        const chars = Array.from(text);
        const entities: RedactedEntity[] = [];
        for (const e of response.Entities ?? []) {
            if (e.BeginOffset === undefined || e.EndOffset === undefined || !e.Type) continue;
            if (entityTypes && !entityTypes.includes(e.Type)) continue;
            entities.push({
                type: e.Type,
                score: e.Score,
                start: e.BeginOffset,
                end: e.EndOffset,
                text: chars.slice(e.BeginOffset, e.EndOffset).join(""),
            });
        }
        entities.sort((a, b) => a.start - b.start || b.end - a.end);

        // Merge overlapping spans so no part of an entity is left unmasked.
        const spans: RedactedEntity[] = [];
        for (const e of entities) {
            const last = spans[spans.length - 1];
            if (last && e.start < last.end) {
                if (e.end > last.end) {
                    last.end = e.end;
                    last.text = chars.slice(last.start, last.end).join("");
                }
            } else {
                spans.push({ ...e });
            }
        }

        // Replace from the end so earlier offsets stay valid.
        for (let i = spans.length - 1; i >= 0; i--) {
            const s = spans[i];
            const replacement = typeof mask === "function" ? mask(s.type, s.text) : mask;
            chars.splice(s.start, s.end - s.start, replacement);
        }
        return { redacted: chars.join(""), entities };
    }

    /** Convenience for chaining in front of an endpoint: returns only the redacted string. */
    async redactText(text: string, options: RedactOptions = {}): Promise<string> {
        return (await this.redact(text, options)).redacted;
    }
}

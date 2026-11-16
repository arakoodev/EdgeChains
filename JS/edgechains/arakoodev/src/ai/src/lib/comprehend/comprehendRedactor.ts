export interface PiiEntitySpan {
    Type: string;
    Score: number;
    BeginOffset: number;
    EndOffset: number;
}

export interface ComprehendRedactorOptions {
    region?: string;
    languageCode?: string;
    minConfidenceScore?: number;
    entityTypes?: string[];
    maskMode?: 'TYPE_TAG' | 'ASTERISK';
    maskCharacter?: string;
    comprehendClient?: {
        detectPiiEntities: (params: { Text: string; LanguageCode: string }) => Promise<{ Entities: PiiEntitySpan[] }>;
    };
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntitySpan[];
}

export interface ChainableEndpoint<TInput = string, TOutput = any> {
    call(prompt: TInput): Promise<TOutput>;
}

const DEFAULT_PATTERNS: Array<{ type: string; regex: RegExp }> = [
    { type: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    { type: 'CREDIT_DEBIT_NUMBER', regex: /\b(?:\d[ -]*?){13,16}\b/g },
    { type: 'PHONE', regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
    { type: 'AWS_ACCESS_KEY', regex: /\bAKIA[0-9A-Z]{16}\b/g },
];

export class ComprehendRedactor {
    private languageCode: string;
    private minScore: number;
    private allowedTypes: Set<string> | null;
    private maskMode: 'TYPE_TAG' | 'ASTERISK';
    private maskChar: string;
    private client?: ComprehendRedactorOptions['comprehendClient'];

    constructor(options: ComprehendRedactorOptions = {}) {
        this.languageCode = options.languageCode || 'en';
        this.minScore = options.minConfidenceScore ?? 0.5;
        this.allowedTypes = options.entityTypes ? new Set(options.entityTypes) : null;
        this.maskMode = options.maskMode || 'TYPE_TAG';
        this.maskChar = options.maskCharacter || '*';
        this.client = options.comprehendClient;
    }

    async detectEntities(text: string): Promise<PiiEntitySpan[]> {
        if (this.client) {
            const resp = await this.client.detectPiiEntities({
                Text: text,
                LanguageCode: this.languageCode,
            });
            return (resp.Entities || []).filter((e) => {
                if (e.Score < this.minScore) return false;
                if (this.allowedTypes && !this.allowedTypes.has(e.Type)) return false;
                return true;
            });
        }

        const detected: PiiEntitySpan[] = [];
        for (const { type, regex } of DEFAULT_PATTERNS) {
            if (this.allowedTypes && !this.allowedTypes.has(type)) continue;
            const copy = new RegExp(regex.source, regex.flags);
            let match: RegExpExecArray | null;
            while ((match = copy.exec(text)) !== null) {
                detected.push({
                    Type: type,
                    Score: 0.99,
                    BeginOffset: match.index,
                    EndOffset: match.index + match[0].length,
                });
            }
        }
        return detected.sort((a, b) => a.BeginOffset - b.BeginOffset);
    }

    applyEntitiesRedaction(text: string, entities: PiiEntitySpan[]): string {
        if (!entities.length) return text;
        const sorted = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
        let output = text;
        for (const entity of sorted) {
            const spanLen = Math.max(entity.EndOffset - entity.BeginOffset, 1);
            const replacement =
                this.maskMode === 'ASTERISK'
                    ? this.maskChar.repeat(spanLen)
                    : `[REDACTED_${entity.Type}]`;
            output =
                output.slice(0, entity.BeginOffset) +
                replacement +
                output.slice(entity.EndOffset);
        }
        return output;
    }

    async redact(text: string): Promise<RedactionResult> {
        const entities = await this.detectEntities(text);
        const redactedText = this.applyEntitiesRedaction(text, entities);
        return {
            originalText: text,
            redactedText,
            entities,
        };
    }

    chainWithEndpoint<TOutput>(endpoint: ChainableEndpoint<string, TOutput>) {
        return {
            subscribe: async (
                prompt: string,
                observer: {
                    next?: (val: { redaction: RedactionResult; response: TOutput }) => void;
                    error?: (err: unknown) => void;
                    complete?: () => void;
                }
            ) => {
                try {
                    const redaction = await this.redact(prompt);
                    const response = await endpoint.call(redaction.redactedText);
                    observer.next?.({ redaction, response });
                    observer.complete?.();
                } catch (err) {
                    observer.error?.(err);
                }
            },
        };
    }
}

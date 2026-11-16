import test from 'node:test';
import assert from 'node:assert/strict';

class ComprehendRedactor {
    constructor(options = {}) {
        this.languageCode = options.languageCode || 'en';
        this.minScore = options.minConfidenceScore ?? 0.5;
        this.maskMode = options.maskMode || 'TYPE_TAG';
        this.maskChar = options.maskCharacter || '*';
        this.client = options.comprehendClient;
    }

    async detectEntities(text) {
        if (this.client) {
            const resp = await this.client.detectPiiEntities({ Text: text, LanguageCode: this.languageCode });
            return (resp.Entities || []).filter((e) => e.Score >= this.minScore);
        }
        const patterns = [
            { type: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
            { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
        ];
        const out = [];
        for (const { type, regex } of patterns) {
            let m;
            while ((m = regex.exec(text)) !== null) {
                out.push({ Type: type, Score: 0.99, BeginOffset: m.index, EndOffset: m.index + m[0].length });
            }
        }
        return out;
    }

    async redact(text) {
        const entities = await this.detectEntities(text);
        const sorted = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
        let redactedText = text;
        for (const e of sorted) {
            const rep = this.maskMode === 'ASTERISK'
                ? this.maskChar.repeat(e.EndOffset - e.BeginOffset)
                : `[REDACTED_${e.Type}]`;
            redactedText = redactedText.slice(0, e.BeginOffset) + rep + redactedText.slice(e.EndOffset);
        }
        return { originalText: text, redactedText, entities };
    }

    chainWithEndpoint(endpoint) {
        return {
            subscribe: async (prompt, observer) => {
                const redaction = await this.redact(prompt);
                const response = await endpoint.call(redaction.redactedText);
                observer.next({ redaction, response });
            },
        };
    }
}

test('ComprehendRedactor redacts AWS Comprehend DetectPiiEntities spans accurately', async () => {
    const input = 'Contact Alice at alice@example.com regarding account 99.';
    const mockComprehend = {
        async detectPiiEntities({ Text }) {
            const idx = Text.indexOf('alice@example.com');
            return {
                Entities: [
                    { Type: 'EMAIL', Score: 0.998, BeginOffset: idx, EndOffset: idx + 'alice@example.com'.length },
                ],
            };
        },
    };
    const redactor = new ComprehendRedactor({ comprehendClient: mockComprehend });
    const res = await redactor.redact(input);
    assert.equal(res.redactedText, 'Contact Alice at [REDACTED_EMAIL] regarding account 99.');
    assert.equal(res.entities.length, 1);
});

test('ComprehendRedactor chains as an observable before LLM endpoint call', async () => {
    const redactor = new ComprehendRedactor();
    const capturedPrompts = [];
    const mockEndpoint = {
        async call(prompt) {
            capturedPrompts.push(prompt);
            return { ok: true };
        },
    };

    const obs = redactor.chainWithEndpoint(mockEndpoint);
    let emitted = null;
    await obs.subscribe('Email bob@company.org with SSN 123-45-6789', {
        next: (v) => {
            emitted = v;
        },
    });
    assert.equal(capturedPrompts[0], 'Email [REDACTED_EMAIL] with SSN [REDACTED_SSN]');
    assert.equal(emitted.response.ok, true);
});

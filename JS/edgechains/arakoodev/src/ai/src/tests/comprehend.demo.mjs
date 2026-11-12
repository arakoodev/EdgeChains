// Local deterministic demo: no paid API calls or cloud credentials.
// Run from repository root with Node 24:
// node JS/edgechains/arakoodev/src/ai/src/tests/comprehend.demo.mjs
import { ComprehendPiiRedactor } from '../lib/comprehend/comprehend.ts';

const redactor = new ComprehendPiiRedactor({
    language: 'es',
    detector: {
        async detect(text) {
            // Fixture detector only. In production, omit `detector` to use AWS Comprehend.
            const chars = Array.from(text);
            const email = 'ana@example.com';
            const start = chars.join('').indexOf(email);
            return start < 0 ? [] : [{BeginOffset:start,EndOffset:start+email.length}];
        },
    },
});

const endpoint = {
    async chat(options) {
        console.log('Text received by downstream endpoint:', options.prompt);
        return { content: 'Redacted prompt received.' };
    },
};

console.log('Demo uses synthetic data and a fixture detector.');
await redactor.next(endpoint).chat({prompt:'Mi correo es ana@example.com.'});

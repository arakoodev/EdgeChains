import { ComprehendRedactor } from '../../src/ai/src/lib/comprehend/comprehendRedactor';

export async function runComprehendRedactionDemo() {
    const redactor = new ComprehendRedactor({ region: 'us-east-1', maskMode: 'TYPE_TAG' });
    const mockOpenAiEndpoint = {
        async call(redactedPrompt: string) {
            return {
                model: 'gpt-4o-mini',
                receivedPrompt: redactedPrompt,
                reply: 'Processed safely with zero raw PII.',
            };
        },
    };

    const chain = redactor.chainWithEndpoint(mockOpenAiEndpoint);
    let finalOutput: any = null;
    await chain.subscribe(
        'Customer john.doe@acme.io called from 415-555-0199 with SSN 123-45-6789.',
        {
            next: (payload) => {
                finalOutput = payload;
            },
        }
    );
    return finalOutput;
}

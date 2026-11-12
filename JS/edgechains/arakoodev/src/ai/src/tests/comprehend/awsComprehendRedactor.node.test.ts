import assert from "node:assert/strict";
import test from "node:test";
import {
    AwsComprehendRedactor,
    PiiObservable,
    type PiiEntity,
} from "../../lib/comprehend/AwsComprehendRedactor.ts";

function createMockComprehendFetch(entities: PiiEntity[], status = 200) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init || {} });
        return {
            ok: status >= 200 && status < 300,
            status,
            text: async () => JSON.stringify({ Entities: entities }),
        } as Response;
    }) as typeof fetch;
    return { fetchMock, calls };
}

test("AwsComprehendRedactor signs request with SigV4 and redacts detected PII spans", async () => {
    const prompt = "Hello, my name is Alice Smith and my email is alice@example.com.";
    const { fetchMock, calls } = createMockComprehendFetch([
        { Type: "NAME", Score: 0.99, BeginOffset: 18, EndOffset: 29 },
        { Type: "EMAIL", Score: 0.99, BeginOffset: 46, EndOffset: 63 },
    ]);

    const redactor = new AwsComprehendRedactor({
        region: "us-east-1",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        fetchImpl: fetchMock,
    });

    const result = await redactor.redactWithDetails(prompt);

    assert.equal(
        result.redactedText,
        "Hello, my name is [NAME] and my email is [EMAIL]."
    );
    assert.equal(result.entities.length, 2);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://comprehend.us-east-1.amazonaws.com/");
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["X-Amz-Target"], "Comprehend_20171127.DetectPiiEntities");
    assert.match(headers["Authorization"], /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\//);
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
        Text: prompt,
        LanguageCode: "en",
    });
});

test("AwsComprehendRedactor supports CHARACTER maskMode and minScore/piiTypes filtering", async () => {
    const prompt = "Call 415-555-0199 or email bob@example.com";
    const { fetchMock } = createMockComprehendFetch([
        { Type: "PHONE", Score: 0.92, BeginOffset: 5, EndOffset: 17 },
        { Type: "EMAIL", Score: 0.45, BeginOffset: 27, EndOffset: 42 },
    ]);

    const redactor = new AwsComprehendRedactor({
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        minScore: 0.8,
        maskMode: "CHARACTER",
        maskCharacter: "#",
        fetchImpl: fetchMock,
    });

    const redacted = await redactor.redact(prompt);
    assert.equal(redacted, "Call ############ or email bob@example.com");
});

test("AwsComprehendRedactor chains with Endpoint classes via PiiObservable and wrapEndpoint", async () => {
    const prompt = "Customer SSN is 123-45-6789 and email is jane@arakoo.ai";
    const { fetchMock } = createMockComprehendFetch([
        { Type: "SSN", Score: 0.99, BeginOffset: 16, EndOffset: 27 },
        { Type: "EMAIL", Score: 0.98, BeginOffset: 41, EndOffset: 55 },
    ]);

    const redactor = new AwsComprehendRedactor({
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        fetchImpl: fetchMock,
    });

    const receivedPrompts: string[] = [];
    const mockEndpoint = {
        async chat(options: { prompt: string; temperature?: number }) {
            receivedPrompts.push(options.prompt);
            return { content: `Processed safe prompt: ${options.prompt}` };
        },
    };

    // 1. Observable chaining
    const chainedResult = await redactor
        .chainWithEndpoint(mockEndpoint, { prompt, temperature: 0.2 })
        .toPromise();

    assert.equal(
        chainedResult.redactedOptions.prompt,
        "Customer SSN is [SSN] and email is [EMAIL]"
    );
    assert.equal(
        chainedResult.response.content,
        "Processed safe prompt: Customer SSN is [SSN] and email is [EMAIL]"
    );

    // 2. Proxy wrapped endpoint
    const safeEndpoint = redactor.wrapEndpoint(mockEndpoint);
    const proxyRes = await safeEndpoint.chat({ prompt });
    assert.equal(
        proxyRes.content,
        "Processed safe prompt: Customer SSN is [SSN] and email is [EMAIL]"
    );
    assert.equal(receivedPrompts.length, 2);
});

test("AwsComprehendRedactor falls back to local regex PII detection when fallbackToRegex is true", async () => {
    const redactor = new AwsComprehendRedactor({
        fallbackToRegex: true,
    });

    const input = "Reach me at support@edgechains.dev or 123-45-6789.";
    const output = await PiiObservable.of(input).pipe(redactor.asOperator()).toPromise();

    assert.equal(output, "Reach me at [EMAIL] or [SSN].");
});

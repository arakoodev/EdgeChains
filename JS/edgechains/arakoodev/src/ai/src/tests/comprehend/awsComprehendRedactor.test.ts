import {
    AwsComprehendRedactor,
    PiiObservable,
    type PiiEntity,
} from "../../lib/comprehend/AwsComprehendRedactor.js";

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

describe("AwsComprehendRedactor", () => {
    test("redacts PII entities returned by AWS Comprehend DetectPiiEntities", async () => {
        const prompt = "My name is John Doe and my email is john.doe@example.com";
        const { fetchMock, calls } = createMockComprehendFetch([
            { Type: "NAME", Score: 0.99, BeginOffset: 11, EndOffset: 19 },
            { Type: "EMAIL", Score: 0.99, BeginOffset: 36, EndOffset: 56 },
        ]);

        const redactor = new AwsComprehendRedactor({
            region: "us-west-2",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            fetchImpl: fetchMock,
        });

        const redacted = await redactor.redact(prompt);
        expect(redacted).toBe("My name is [NAME] and my email is [EMAIL]");
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe("https://comprehend.us-west-2.amazonaws.com/");
    });

    test("chains with Endpoint classes as an Observable to redact prompts and messages", async () => {
        const { fetchMock } = createMockComprehendFetch([
            { Type: "EMAIL", Score: 0.99, BeginOffset: 9, EndOffset: 24 },
        ]);

        const redactor = new AwsComprehendRedactor({
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            fetchImpl: fetchMock,
        });

        const mockEndpoint = {
            chat: async (opts: { prompt?: string; messages?: Array<{ role: string; content: string }> }) => {
                return { echoedPrompt: opts.prompt, echoedMessages: opts.messages };
            },
        };

        const result = await redactor
            .chainWithEndpoint(mockEndpoint, {
                prompt: "Contact: dev@arakoo.ai for details",
                messages: [{ role: "user", content: "Contact: dev@arakoo.ai for details" }],
            })
            .toPromise();

        expect(result.redactedOptions.prompt).toBe("Contact: [EMAIL] for details");
        expect(result.response.echoedMessages?.[0].content).toBe("Contact: [EMAIL] for details");
    });

    test("supports offline regex fallback via PiiObservable pipeline", async () => {
        const redactor = new AwsComprehendRedactor({ fallbackToRegex: true });
        const redacted = await PiiObservable.of("SSN: 123-45-6789")
            .pipe(redactor.asOperator())
            .toPromise();

        expect(redacted).toBe("SSN: [SSN]");
    });
});

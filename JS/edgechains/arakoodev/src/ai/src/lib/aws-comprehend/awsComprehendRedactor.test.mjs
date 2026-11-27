import test from "node:test";
import assert from "node:assert/strict";
import { AWSComprehendRedactor } from "./awsComprehendRedactor.ts";

class MockComprehendTransport {
    constructor(entities) {
        this.entities = entities;
    }
    async detectPiiEntities() {
        return { Entities: this.entities };
    }
}

test("redacts multiple PII entities accurately from right to left", async () => {
    const prompt = "Contact Alice at alice@example.com or 555-0199 regarding SSN 123-45-6789.";
    const transport = new MockComprehendTransport([
        { Type: "EMAIL", Score: 0.99, BeginOffset: 17, EndOffset: 34 },
        { Type: "PHONE", Score: 0.95, BeginOffset: 38, EndOffset: 46 },
        { Type: "SSN", Score: 0.98, BeginOffset: 61, EndOffset: 72 },
    ]);

    const redactor = new AWSComprehendRedactor({ transport, minConfidence: 0.8 });
    const res = await redactor.redact(prompt);

    assert.equal(
        res.redactedText,
        "Contact Alice at [REDACTED_EMAIL] or [REDACTED_PHONE] regarding SSN [REDACTED_SSN]."
    );
    assert.equal(res.redactedCount, 3);
});

test("respects minConfidence and redactTypes filters", async () => {
    const prompt = "Email bob@test.io from IP 10.0.0.1";
    const transport = new MockComprehendTransport([
        { Type: "EMAIL", Score: 0.92, BeginOffset: 6, EndOffset: 17 },
        { Type: "IP_ADDRESS", Score: 0.55, BeginOffset: 26, EndOffset: 34 },
    ]);

    const redactor = new AWSComprehendRedactor({
        transport,
        minConfidence: 0.75,
        redactTypes: ["EMAIL"],
    });
    const res = await redactor.redact(prompt);

    assert.equal(res.redactedText, "Email [REDACTED_EMAIL] from IP 10.0.0.1");
    assert.equal(res.redactedCount, 1);
});

test("chains as observable with EdgeChains Endpoint (chat)", async () => {
    const prompt = "Summarize invoice for john@acme.com";
    const transport = new MockComprehendTransport([
        { Type: "EMAIL", Score: 0.99, BeginOffset: 22, EndOffset: 35 },
    ]);

    let receivedPrompt = "";
    const mockEndpoint = {
        async chat(opts) {
            receivedPrompt = opts.prompt;
            return { content: "Summary complete." };
        },
    };

    const redactor = new AWSComprehendRedactor({ transport });
    const result = await redactor.chainWithEndpoint(prompt, mockEndpoint, { model: "gpt-4o-mini" }).toPromise();

    assert.equal(receivedPrompt, "Summarize invoice for [REDACTED_EMAIL]");
    assert.equal(result.response.content, "Summary complete.");
    assert.equal(result.redaction.redactedCount, 1);
});

test("supports subscribe() observable pattern and empty input", async () => {
    const redactor = new AWSComprehendRedactor({ transport: new MockComprehendTransport([]) });
    let captured = null;
    await redactor.redactAsObservable("").subscribe((val) => {
        captured = val;
    });
    assert.equal(captured.redactedText, "");
    assert.equal(captured.redactedCount, 0);
});

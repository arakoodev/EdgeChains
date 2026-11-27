import { Comprehend } from "../../../../dist/ai/src/lib/comprehend/comprehend.js";

// Mock the AWS SDK client so redaction can be exercised without live AWS.
jest.mock("@aws-sdk/client-comprehend", () => {
    return {
        ComprehendClient: jest.fn().mockImplementation(() => ({
            send: jest.fn(),
        })),
        DetectPiiEntitiesCommand: jest.fn().mockImplementation((input) => ({ input })),
    };
});

import { ComprehendClient } from "@aws-sdk/client-comprehend";

function mockEntities(entities: any[]) {
    (ComprehendClient as unknown as jest.Mock).mockImplementation(() => ({
        send: jest.fn().mockResolvedValue({ Entities: entities }),
    }));
}

describe("Comprehend PII redactor", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("constructs a client", () => {
        mockEntities([]);
        const comprehend = new Comprehend({ region: "us-east-1" });
        expect(comprehend.client).toBeDefined();
    });

    it("detects PII entities", async () => {
        mockEntities([{ Type: "EMAIL", BeginOffset: 0, EndOffset: 5, Score: 0.99 }]);
        const comprehend = new Comprehend();
        const entities = await comprehend.detectPiiEntities("a@b.com");
        expect(entities).toHaveLength(1);
        expect(entities[0].Type).toBe("EMAIL");
    });

    it("redacts an email entity", async () => {
        const text = "Contact john.doe@example.com now";
        const begin = text.indexOf("john.doe@example.com");
        const end = begin + "john.doe@example.com".length;
        mockEntities([{ Type: "EMAIL", BeginOffset: begin, EndOffset: end, Score: 0.99 }]);
        const comprehend = new Comprehend();
        const { redactedText } = await comprehend.redact({ text });
        expect(redactedText).toBe("Contact [REDACTED] now");
        expect(redactedText).not.toContain("john.doe@example.com");
    });

    it("redacts multiple entities with a custom mask and respects offsets", async () => {
        const text = "SSN 123-45-6789 email a@b.com";
        const ssnBegin = text.indexOf("123-45-6789");
        const ssnEnd = ssnBegin + "123-45-6789".length;
        const emailBegin = text.indexOf("a@b.com");
        const emailEnd = emailBegin + "a@b.com".length;
        mockEntities([
            { Type: "SSN", BeginOffset: ssnBegin, EndOffset: ssnEnd, Score: 0.99 },
            { Type: "EMAIL", BeginOffset: emailBegin, EndOffset: emailEnd, Score: 0.99 },
        ]);
        const comprehend = new Comprehend();
        const { redactedText } = await comprehend.redact({ text, mask: "*" });
        expect(redactedText).toBe("SSN * email *");
    });

    it("only redacts requested entity types", async () => {
        const text = "email a@b.com";
        const begin = text.indexOf("a@b.com");
        const end = begin + "a@b.com".length;
        mockEntities([{ Type: "EMAIL", BeginOffset: begin, EndOffset: end, Score: 0.99 }]);
        const comprehend = new Comprehend();
        const { redactedText } = await comprehend.redact({ text, types: ["SSN"] });
        expect(redactedText).toBe(text);
    });
});
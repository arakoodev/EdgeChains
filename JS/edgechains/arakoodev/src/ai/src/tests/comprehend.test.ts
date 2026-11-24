import { AWSComprehendPIIRedactor } from "../../../../dist/ai/src/lib/comprehend/comprehend.js";

// Mock the AWS Comprehend client so no network calls are made. The utility
// under test (AWSComprehendPIIRedactor) is the real implementation; only the
// underlying AWS SDK client is mocked.
jest.mock("@aws-sdk/client-comprehend", () => {
    return {
        ComprehendClient: jest.fn().mockImplementation(() => ({
            send: jest.fn(),
        })),
        DetectPiiEntitiesCommand: jest.fn().mockImplementation((input) => ({ input })),
        PiiEntitiesDetectionMaskMode: { ONLY_REDACTION: "ONLY_REDACTION" },
    };
});

const SAMPLE_TEXT = "My name is John Doe and my email is john.doe@example.com";

const MOCK_ENTITIES = [
    { Type: "NAME", BeginOffset: 11, EndOffset: 19, Score: 0.99 },
    { Type: "EMAIL", BeginOffset: 36, EndOffset: 56, Score: 0.98 },
];

describe("AWSComprehendPIIRedactor", () => {
    let redactor: AWSComprehendPIIRedactor;

    beforeEach(() => {
        redactor = new AWSComprehendPIIRedactor({ region: "us-east-1" });
        // Wire the mocked client's send() to return our canned entities.
        (redactor.client as any).send = jest.fn().mockResolvedValue({ Entities: MOCK_ENTITIES });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("detectPiiEntities returns mapped entities", async () => {
        const entities = await redactor.detectPiiEntities(SAMPLE_TEXT);
        expect(entities).toHaveLength(2);
        expect(entities[0]).toEqual({
            type: "NAME",
            beginOffset: 11,
            endOffset: 19,
            score: 0.99,
        });
    });

    test("redact masks every detected PII entity", async () => {
        const result = await redactor.redact({ text: SAMPLE_TEXT });
        expect(result.redactedText).toBe("My name is *** and my email is ***");
        expect(result.entities).toHaveLength(2);
    });

    test("redact honours a custom mask character", async () => {
        const result = await redactor.redact({ text: SAMPLE_TEXT, maskChar: "[REDACTED]" });
        expect(result.redactedText).toBe(
            "My name is [REDACTED] and my email is [REDACTED]"
        );
    });

    test("redact only redacts entity types in the allow-list", async () => {
        const result = await redactor.redact({ text: SAMPLE_TEXT, entityTypes: ["EMAIL"] });
        // Only the email is masked; the name remains untouched.
        expect(result.redactedText).toBe("My name is John Doe and my email is ***");
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].type).toBe("EMAIL");
    });
});
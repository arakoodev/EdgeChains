import {
    AwsComprehendRedactor,
    ComprehendClientLike,
    redactByOffsets,
} from "../lib/aws-comprehend/comprehend";

class MockDetectPiiEntitiesCommand {
    input: { Text: string; LanguageCode: string };

    constructor(input: { Text: string; LanguageCode: string }) {
        this.input = input;
    }
}

describe("AwsComprehendRedactor", () => {
    test("redacts PII entities returned by AWS Comprehend offsets", async () => {
        const client: ComprehendClientLike = {
            send: jest.fn().mockResolvedValue({
                Entities: [
                    { Type: "EMAIL", Score: 0.99, BeginOffset: 18, EndOffset: 34 },
                    { Type: "PHONE", Score: 0.98, BeginOffset: 39, EndOffset: 51 },
                ],
            }),
        };
        const redactor = new AwsComprehendRedactor({
            client,
            commandCtor: MockDetectPiiEntitiesCommand,
        });

        const result = await redactor.redactText("Customer contact: jane@example.com and +15551234567");

        expect(result.text).toBe(
            "Customer contact: [REDACTED:EMAIL] and [REDACTED:PHONE]"
        );
        expect(result.entities).toHaveLength(2);
        expect(client.send).toHaveBeenCalledWith(expect.any(MockDetectPiiEntitiesCommand));
    });

    test("filters entities by score and type", async () => {
        const client: ComprehendClientLike = {
            send: jest.fn().mockResolvedValue({
                Entities: [
                    { Type: "EMAIL", Score: 0.99, BeginOffset: 4, EndOffset: 20 },
                    { Type: "NAME", Score: 0.99, BeginOffset: 24, EndOffset: 35 },
                    { Type: "PHONE", Score: 0.20, BeginOffset: 42, EndOffset: 54 },
                ],
            }),
        };
        const redactor = new AwsComprehendRedactor({
            client,
            commandCtor: MockDetectPiiEntitiesCommand,
            entityTypes: ["EMAIL", "PHONE"],
            minScore: 0.9,
            mask: "[PRIVATE]",
        });

        const result = await redactor.redactText("PII jane@example.com for Jane Smith at +15551234567");

        expect(result.text).toBe("PII [PRIVATE] for Jane Smith at +15551234567");
        expect(result.entities).toEqual([
            { Type: "EMAIL", Score: 0.99, BeginOffset: 4, EndOffset: 20 },
        ]);
    });

    test("redacts chat messages without mutating metadata", async () => {
        const client: ComprehendClientLike = {
            send: jest.fn().mockResolvedValue({
                Entities: [{ Type: "EMAIL", Score: 0.99, BeginOffset: 7, EndOffset: 23 }],
            }),
        };
        const redactor = new AwsComprehendRedactor({
            client,
            commandCtor: MockDetectPiiEntitiesCommand,
        });

        const result = await redactor.redactMessages([
            { role: "user", name: "customer", content: "Email: jane@example.com" },
        ]);

        expect(result).toEqual([
            { role: "user", name: "customer", content: "Email: [REDACTED:EMAIL]" },
        ]);
    });
});

describe("redactByOffsets", () => {
    test("applies replacements from right to left so offsets remain stable", () => {
        const result = redactByOffsets("a@example.com and Bob", [
            { Type: "EMAIL", BeginOffset: 0, EndOffset: 13 },
            { Type: "NAME", BeginOffset: 18, EndOffset: 21 },
        ]);

        expect(result).toBe("[REDACTED:EMAIL] and [REDACTED:NAME]");
    });

    test("ignores invalid offsets", () => {
        const result = redactByOffsets("safe text", [
            { Type: "EMAIL", BeginOffset: -1, EndOffset: 99 },
        ]);

        expect(result).toBe("safe text");
    });
});

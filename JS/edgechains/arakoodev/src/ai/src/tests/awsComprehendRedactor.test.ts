import { AwsComprehendRedactor } from "../lib/aws-comprehend/awsComprehendRedactor";

describe("AwsComprehendRedactor", () => {
    test("redacts PII entities returned by AWS Comprehend", async () => {
        const client = {
            detectPiiEntities: jest.fn().mockResolvedValue({
                Entities: [
                    { Type: "NAME", BeginOffset: 0, EndOffset: 10, Score: 0.99 },
                    { Type: "EMAIL", BeginOffset: 26, EndOffset: 42, Score: 0.98 },
                ],
            }),
        };

        const redactor = new AwsComprehendRedactor({ client });
        const result = await redactor.redact("Jane Smith can be reached jane@example.com");

        expect(client.detectPiiEntities).toHaveBeenCalledWith({
            Text: "Jane Smith can be reached jane@example.com",
            LanguageCode: "en",
        });
        expect(result.redactedText).toBe("[NAME_REDACTED] can be reached [EMAIL_REDACTED]");
        expect(result.entities).toHaveLength(2);
    });

    test("supports score, type filters and custom replacement", async () => {
        const client = {
            detectPiiEntities: jest.fn().mockResolvedValue({
                Entities: [
                    { Type: "NAME", BeginOffset: 0, EndOffset: 4, Score: 0.99 },
                    { Type: "PHONE", BeginOffset: 11, EndOffset: 19, Score: 0.4 },
                    { Type: "EMAIL", BeginOffset: 23, EndOffset: 34, Score: 0.95 },
                ],
            }),
        };

        const redactor = new AwsComprehendRedactor({
            client,
            minScore: 0.9,
            entityTypes: ["EMAIL", "PHONE"],
            replacement: (entity) => `<${entity.Type}>`,
        });

        const result = await redactor.redact("John phone 555-1212 or a@b.example");

        expect(result.redactedText).toBe("John phone 555-1212 or <EMAIL>");
        expect(result.entities.map((entity) => entity.Type)).toEqual(["EMAIL"]);
    });

    test("supports AWS SDK v3 clients through send and a command factory", async () => {
        class DetectPiiEntitiesCommand {
            input: unknown;
            constructor(input: unknown) {
                this.input = input;
            }
        }

        const client = {
            send: jest.fn().mockResolvedValue({
                Entities: [{ Type: "SSN", BeginOffset: 4, EndOffset: 15, Score: 1 }],
            }),
        };

        const redactor = new AwsComprehendRedactor({
            client,
            commandFactory: DetectPiiEntitiesCommand,
            replacement: "[REDACTED]",
        });

        const result = await redactor.redact("SSN 123-45-6789");

        expect(client.send).toHaveBeenCalledWith(expect.any(DetectPiiEntitiesCommand));
        expect(result.redactedText).toBe("SSN [REDACTED]");
    });
});

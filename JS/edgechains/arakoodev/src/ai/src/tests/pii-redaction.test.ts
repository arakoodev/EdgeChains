import { PIIRedaction } from "../../../../dist/ai/src/lib/aws-comprehend/pii-redaction.js";

// Mock the AWS Comprehend client
jest.mock("@aws-sdk/client-comprehend", () => {
    const originalModule = jest.requireActual("@aws-sdk/client-comprehend");
    return {
        ...originalModule,
        ComprehendClient: jest.fn().mockImplementation(() => ({
            send: jest.fn(),
        })),
        DetectPiiEntitiesCommand: jest.fn(),
    };
});

const { ComprehendClient, DetectPiiEntitiesCommand } = require("@aws-sdk/client-comprehend");

describe("PIIRedaction", () => {
    let piiRedaction: PIIRedaction;
    let mockSend: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSend = jest.fn();
        (ComprehendClient as jest.Mock).mockImplementation(() => ({
            send: mockSend,
        }));
        piiRedaction = new PIIRedaction({
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            region: "us-east-1",
        });
    });

    describe("redact", () => {
        it("should detect and redact PII entities, replacing with entity type", async () => {
            const mockEntities = [
                { Type: "NAME", Score: 0.99, BeginOffset: 20, EndOffset: 30 },
                { Type: "EMAIL", Score: 0.98, BeginOffset: 50, EndOffset: 70 },
                { Type: "PHONE", Score: 0.99, BeginOffset: 80, EndOffset: 92 },
            ];

            mockSend.mockResolvedValueOnce({ Entities: mockEntities });

            const result = await piiRedaction.redact(
                "Hello, my name is John Doe. My email is john@example.com and my phone is 555-123-4567."
            );

            expect(result.originalText).toContain("John Doe");
            expect(result.redactedText).toContain("[NAME]");
            expect(result.redactedText).toContain("[EMAIL]");
            expect(result.redactedText).toContain("[PHONE]");
            expect(result.entities).toHaveLength(3);
            expect(result.entities[0].type).toBe("NAME");
            expect(mockSend).toHaveBeenCalledTimes(1);
        });

        it("should redact with character mask when REPLACE_WITH_CHARACTER mode is set", async () => {
            const charRedact = new PIIRedaction({
                accessKeyId: "test-key",
                secretAccessKey: "test-secret",
                redactionMode: "REPLACE_WITH_CHARACTER",
                maskCharacter: "#",
            });

            (ComprehendClient as jest.Mock).mockImplementation(() => ({
                send: mockSend,
            }));

            const mockEntities = [
                { Type: "NAME", Score: 0.99, BeginOffset: 6, EndOffset: 14 },
            ];

            mockSend.mockResolvedValueOnce({ Entities: mockEntities });

            const result = await charRedact.redact("Hello John Smith!");

            expect(result.redactedText).toBe("Hello ########!");
            expect(result.redactedText).not.toContain("John");
        });

        it("should filter entities below confidence threshold", async () => {
            const highConfidence = new PIIRedaction({
                accessKeyId: "test-key",
                secretAccessKey: "test-secret",
                confidenceThreshold: 0.8,
            });

            (ComprehendClient as jest.Mock).mockImplementation(() => ({
                send: mockSend,
            }));

            const mockEntities = [
                { Type: "NAME", Score: 0.99, BeginOffset: 0, EndOffset: 4 },
                { Type: "EMAIL", Score: 0.3, BeginOffset: 10, EndOffset: 25 },
            ];

            mockSend.mockResolvedValueOnce({ Entities: mockEntities });

            const result = await highConfidence.redact("John john@example.com");

            expect(result.entities).toHaveLength(1);
            expect(result.entities[0].type).toBe("NAME");
        });

        it("should filter by specified PII entity types", async () => {
            const filtered = new PIIRedaction({
                accessKeyId: "test-key",
                secretAccessKey: "test-secret",
                piiEntityTypes: ["EMAIL" as any, "PHONE" as any],
            });

            (ComprehendClient as jest.Mock).mockImplementation(() => ({
                send: mockSend,
            }));

            const mockEntities = [
                { Type: "NAME", Score: 0.99, BeginOffset: 0, EndOffset: 4 },
                { Type: "EMAIL", Score: 0.99, BeginOffset: 10, EndOffset: 25 },
            ];

            mockSend.mockResolvedValueOnce({ Entities: mockEntities });

            const result = await filtered.redact("John john@example.com");

            expect(result.entities).toHaveLength(1);
            expect(result.entities[0].type).toBe("EMAIL");
        });

        it("should return empty entities when no PII is found", async () => {
            mockSend.mockResolvedValueOnce({ Entities: [] });

            const result = await piiRedaction.redact("No PII here.");

            expect(result.entities).toHaveLength(0);
            expect(result.redactedText).toBe("No PII here.");
        });

        it("should handle overlapping entities by processing from end to start", async () => {
            const mockEntities = [
                { Type: "NAME", Score: 0.99, BeginOffset: 0, EndOffset: 10 },
                { Type: "EMAIL", Score: 0.99, BeginOffset: 20, EndOffset: 35 },
                { Type: "PHONE", Score: 0.99, BeginOffset: 40, EndOffset: 52 },
            ];

            mockSend.mockResolvedValueOnce({ Entities: mockEntities });

            const result = await piiRedaction.redact("JohnSmith  john@example.com  555-1234");

            expect(result.redactedText).toContain("[NAME]");
            expect(result.redactedText).toContain("[EMAIL]");
            expect(result.redactedText).toContain("[PHONE]");
            expect(result.entities).toHaveLength(3);
        });
    });

    describe("constructor", () => {
        it("should use environment variables for credentials when not provided in options", () => {
            process.env.AWS_ACCESS_KEY_ID = "env-key";
            process.env.AWS_SECRET_ACCESS_KEY = "env-secret";
            process.env.AWS_REGION = "eu-west-1";

            const envRedact = new PIIRedaction();
            expect(ComprehendClient).toHaveBeenCalled();

            delete process.env.AWS_ACCESS_KEY_ID;
            delete process.env.AWS_SECRET_ACCESS_KEY;
            delete process.env.AWS_REGION;
        });

        it("should default to us-east-1 when no region is specified", () => {
            const defaultRedact = new PIIRedaction({
                accessKeyId: "test-key",
                secretAccessKey: "test-secret",
            });
            expect(ComprehendClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    region: "us-east-1",
                })
            );
        });

        it("should default to REPLACE_WITH_PII_ENTITY_TYPE redaction mode", async () => {
            const defaultRedact = new PIIRedaction({
                accessKeyId: "test-key",
                secretAccessKey: "test-secret",
            });

            (ComprehendClient as jest.Mock).mockImplementation(() => ({
                send: mockSend,
            }));

            const mockEntities = [
                { Type: "PHONE", Score: 0.99, BeginOffset: 0, EndOffset: 12 },
            ];

            mockSend.mockResolvedValueOnce({ Entities: mockEntities });

            const result = await defaultRedact.redact("555-123-4567");
            expect(result.redactedText).toBe("[PHONE]");
        });
    });
});

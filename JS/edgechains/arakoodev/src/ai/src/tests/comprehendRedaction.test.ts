import { ComprehendRedaction } from "../lib/comprehend/comprehendRedaction";
import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { mockClient } from "aws-sdk-client-mock";

const comprehendMock = mockClient(ComprehendClient);

describe("ComprehendRedaction", () => {
    beforeEach(() => {
        comprehendMock.reset();
    });

    test("should redact PII entities from text", async () => {
        comprehendMock.on(DetectPiiEntitiesCommand).resolves({
            Entities: [
                {
                    Type: "NAME",
                    BeginOffset: 12,
                    EndOffset: 23,
                    Score: 0.99,
                },
            ],
        });

        const redactor = new ComprehendRedaction({ region: "us-east-1" });
        const prompt = "Hello, my name is John Doe and my email is test@example.com";
        const redacted = await redactor.redact(prompt);

        expect(redacted).not.toContain("John Doe");
        expect(redacted).toContain("*********");
    });

    test("should return original text if no PII entities are detected", async () => {
        comprehendMock.on(DetectPiiEntitiesCommand).resolves({
            Entities: [],
        });

        const redactor = new ComprehendRedaction({ region: "us-east-1" });
        const prompt = "Hello world, no sensitive info here.";
        const redacted = await redactor.redact(prompt);

        expect(redacted).toBe(prompt);
    });
});

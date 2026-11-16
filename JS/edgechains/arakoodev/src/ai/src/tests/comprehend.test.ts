import { ComprehendAI } from "../lib/comprehend/comprehend.js";

describe("ComprehendAI PII Redaction (#290)", () => {
    test("redactPii replaces detected PII spans with entity type tags or mask characters", async () => {
        const comprehend = new ComprehendAI({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });

        jest.spyOn(comprehend, "detectPiiEntities").mockResolvedValue([
            { BeginOffset: 11, EndOffset: 19, Score: 0.99, Type: "NAME" },
            { BeginOffset: 28, EndOffset: 44, Score: 0.98, Type: "EMAIL" },
        ]);

        const input = "My name is John Doe, email: john@example.com.";
        const res = await comprehend.redactPii({
            text: input,
            maskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
        });

        expect(res.redactedText).toBe("My name is [NAME], email: [EMAIL].");
        expect(res.entities).toHaveLength(2);
    });
});

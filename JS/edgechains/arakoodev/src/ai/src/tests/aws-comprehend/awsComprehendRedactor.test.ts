import { AwsComprehendRedactor } from "../../lib/aws-comprehend/awsComprehendRedactor.js";

describe("AwsComprehendRedactor", () => {
    test("redacts detected PII entities", async () => {
        const redactor = new AwsComprehendRedactor({
            client: {
                detectPiiEntities: async () => ({
                    Entities: [
                        {
                            Type: "EMAIL",
                            Score: 0.99,
                            BeginOffset: 14,
                            EndOffset: 30,
                        },
                    ],
                }),
            },
        });

        await expect(redactor.redact("Contact me at me@example.com")).resolves.toEqual(
            "Contact me at [EMAIL]"
        );
    });

    test("redacts prompt options for endpoint chaining", async () => {
        const redactor = new AwsComprehendRedactor({
            client: {
                detectPiiEntities: async () => ({
                    Entities: [
                        {
                            Type: "PHONE",
                            Score: 0.99,
                            BeginOffset: 5,
                            EndOffset: 17,
                        },
                    ],
                }),
            },
        });

        await expect(redactor.redactPrompt({ prompt: "Call 415-555-1212" })).resolves.toEqual({
            prompt: "Call [PHONE]",
            messages: undefined,
        });
    });
});

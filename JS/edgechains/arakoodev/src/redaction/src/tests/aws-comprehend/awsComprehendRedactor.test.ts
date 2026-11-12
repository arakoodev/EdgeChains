import { describe, expect, it, vi } from "vitest";
import type { ComprehendClient, PiiEntity } from "@aws-sdk/client-comprehend";
import { AwsComprehendRedactor } from "../../lib/aws-comprehend/awsComprehendRedactor";

const createClient = (entities: PiiEntity[]): ComprehendClient => {
    return {
        send: vi.fn().mockResolvedValue({ Entities: entities }),
    } as unknown as ComprehendClient;
};

describe("AwsComprehendRedactor", () => {
    it("redacts PII entities returned by AWS Comprehend", async () => {
        const text = "Contact Jane at jane@example.com or +1 555 123 4567.";
        const client = createClient([
            {
                Type: "EMAIL",
                BeginOffset: 16,
                EndOffset: 32,
                Score: 0.99,
            },
            {
                Type: "PHONE",
                BeginOffset: 36,
                EndOffset: 51,
                Score: 0.98,
            },
        ]);

        const redactor = new AwsComprehendRedactor({ client });
        const result = await redactor.redact(text);

        expect(result.redactedText).toBe("Contact Jane at [EMAIL] or [PHONE].");
        expect(result.entities).toHaveLength(2);
        expect(client.send).toHaveBeenCalledTimes(1);
    });

    it("supports a custom redaction mask", async () => {
        const text = "My card number is 4111111111111111.";
        const client = createClient([
            {
                Type: "CREDIT_DEBIT_NUMBER",
                BeginOffset: 18,
                EndOffset: 34,
                Score: 0.99,
            },
        ]);

        const redactor = new AwsComprehendRedactor({ client, mask: "[REDACTED]" });
        const redactedText = await redactor.transform(text);

        expect(redactedText).toBe("My card number is [REDACTED].");
    });

    it("does not call AWS for blank text", async () => {
        const client = createClient([]);
        const redactor = new AwsComprehendRedactor({ client });

        const result = await redactor.redact("   ");

        expect(result.redactedText).toBe("   ");
        expect(client.send).not.toHaveBeenCalled();
    });

    it("redacts prompt options without mutating the original object", async () => {
        const client = createClient([
            {
                Type: "EMAIL",
                BeginOffset: 12,
                EndOffset: 28,
                Score: 0.99,
            },
        ]);
        const redactor = new AwsComprehendRedactor({ client });
        const options = {
            model: "gpt-4",
            messages: [{ role: "user", content: "Email me at jane@example.com" }],
        };

        const redactedOptions = await redactor.redactPromptOptions(options);

        expect(redactedOptions).toEqual({
            model: "gpt-4",
            messages: [{ role: "user", content: "Email me at [EMAIL]" }],
        });
        expect(options.messages[0].content).toBe("Email me at jane@example.com");
    });
});

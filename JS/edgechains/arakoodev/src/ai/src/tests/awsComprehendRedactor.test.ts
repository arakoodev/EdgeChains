import { AwsComprehendRedactor } from "../lib/aws-comprehend/awsComprehendRedactor";

describe("AwsComprehendRedactor", () => {
    test("redacts PII returned by AWS Comprehend", async () => {
        const client = {
            send: jest.fn().mockResolvedValue({
                Entities: [
                    {
                        BeginOffset: 8,
                        EndOffset: 24,
                        Type: "EMAIL",
                        Score: 0.99,
                    },
                ],
            }),
        };
        const redactor = new AwsComprehendRedactor({ client });

        const result = await redactor.redactText("Contact jane@example.com");

        expect(result.content).toBe("Contact [REDACTED_EMAIL]");
        expect(result.entities).toHaveLength(1);
        expect(client.send).toHaveBeenCalledTimes(1);
    });

    test("redacts prompts before chaining to another endpoint", async () => {
        const client = {
            send: jest.fn().mockResolvedValue({
                Entities: [
                    {
                        BeginOffset: 11,
                        EndOffset: 27,
                        Type: "EMAIL",
                        Score: 0.99,
                    },
                ],
            }),
        };
        const redactor = new AwsComprehendRedactor({ client });
        const next = jest.fn().mockResolvedValue({ content: "ok" });

        await redactor.chain({ prompt: "Summarize jane@example.com" }, next);

        expect(next).toHaveBeenCalledWith({ prompt: "Summarize [REDACTED_EMAIL]" });
    });

    test("redacts chat message content", async () => {
        const client = {
            send: jest.fn().mockResolvedValue({
                Entities: [
                    {
                        BeginOffset: 5,
                        EndOffset: 17,
                        Type: "PHONE",
                        Score: 0.99,
                    },
                ],
            }),
        };
        const redactor = new AwsComprehendRedactor({ client });

        const result = await redactor.redactPrompt({
            messages: [{ role: "user", content: "Call 555-123-4567" }],
        });

        expect(result.messages?.[0].content).toBe("Call [REDACTED_PHONE]");
    });
});

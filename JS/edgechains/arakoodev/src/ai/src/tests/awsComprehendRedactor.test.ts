import { DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { describe, expect, test, vi } from "vitest";
import { AwsComprehendRedactor } from "../lib/aws-comprehend/comprehendRedactor";

describe("AwsComprehendRedactor", () => {
    test("redacts PII entity spans returned by AWS Comprehend", async () => {
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "EMAIL",
                        Score: 0.99,
                        BeginOffset: 14,
                        EndOffset: 30,
                    },
                ],
            }),
        };
        const redactor = new AwsComprehendRedactor({ client });

        const result = await redactor.redact("Contact me at jane@example.com");

        expect(client.send).toHaveBeenCalledWith(expect.any(DetectPiiEntitiesCommand));
        expect(result.redactedText).toBe("Contact me at ****************");
    });

    test("redacts prompt and messages before calling a chat endpoint", async () => {
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "PHONE",
                        Score: 0.98,
                        BeginOffset: 5,
                        EndOffset: 13,
                    },
                ],
            }),
        };
        const endpoint = {
            chat: vi.fn().mockResolvedValue({ content: "ok" }),
        };
        const redactor = new AwsComprehendRedactor({
            client,
            replacementText: "[REDACTED]",
        });

        await redactor.chat(endpoint, {
            prompt: "Call 555-0100",
            messages: [{ role: "user", content: "Call 555-0100" }],
        });

        expect(endpoint.chat).toHaveBeenCalledWith({
            prompt: "Call [REDACTED]",
            messages: [{ role: "user", content: "Call [REDACTED]" }],
        });
    });

    test("respects score and entity type filters", async () => {
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [
                    { Type: "NAME", Score: 0.99, BeginOffset: 0, EndOffset: 4 },
                    { Type: "EMAIL", Score: 0.4, BeginOffset: 8, EndOffset: 24 },
                ],
            }),
        };
        const redactor = new AwsComprehendRedactor({
            client,
            minScore: 0.9,
            piiEntityTypes: ["NAME"],
            replacementText: "[PII]",
        });

        const result = await redactor.redact("Jane at jane@example.com");

        expect(result.redactedText).toBe("[PII] at jane@example.com");
    });
});

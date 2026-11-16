import { ComprehendRedactor } from "../../../../../dist/ai/src/lib/comprehend/comprehendRedactor.js";
import { firstValueFrom, of } from "rxjs";

describe("ComprehendRedactor", () => {
    it("redacts PII entities detected by AWS Comprehend", async () => {
        const client = {
            send: jest.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "NAME",
                        Score: 0.99,
                        BeginOffset: 3,
                        EndOffset: 13,
                    },
                    {
                        Type: "EMAIL",
                        Score: 0.98,
                        BeginOffset: 28,
                        EndOffset: 44,
                    },
                ],
            }),
        };
        const redactor = new ComprehendRedactor({ client });

        const result = await redactor.redactPrompt({
            text: "Hi Jane Smith, please email jane@example.com today.",
        });

        expect(client.send).toHaveBeenCalledTimes(1);
        expect(result.redactedText).toBe(
            "Hi [NAME], please email [EMAIL] today.",
        );
        expect(result.entities).toEqual([
            {
                type: "NAME",
                score: 0.99,
                beginOffset: 3,
                endOffset: 13,
                text: "Jane Smith",
            },
            {
                type: "EMAIL",
                score: 0.98,
                beginOffset: 28,
                endOffset: 44,
                text: "jane@example.com",
            },
        ]);
    });

    it("supports score and entity-type filters", async () => {
        const client = {
            send: jest.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "NAME",
                        Score: 0.55,
                        BeginOffset: 0,
                        EndOffset: 4,
                    },
                    {
                        Type: "PHONE",
                        Score: 0.99,
                        BeginOffset: 13,
                        EndOffset: 23,
                    },
                    {
                        Type: "EMAIL",
                        Score: 0.99,
                        BeginOffset: 26,
                        EndOffset: 42,
                    },
                ],
            }),
        };
        const redactor = new ComprehendRedactor({ client });

        const result = await redactor.redactPrompt({
            text: "Jane called 5551234567 or jane@example.com.",
            minScore: 0.9,
            entityTypes: ["EMAIL"],
            includeEntityType: false,
            replacement: "[PRIVATE]",
        });

        expect(result.redactedText).toBe(
            "Jane called 5551234567 or [PRIVATE].",
        );
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].type).toBe("EMAIL");
    });

    it("can be chained as an observable redaction step", async () => {
        const client = {
            send: jest.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "EMAIL",
                        Score: 0.99,
                        BeginOffset: 6,
                        EndOffset: 22,
                    },
                ],
            }),
        };
        const redactor = new ComprehendRedactor({ client });

        const result = await firstValueFrom(
            redactor.redactPrompt$(of("Email jane@example.com")),
        );

        expect(result.redactedText).toBe("Email [EMAIL]");
    });
});

import { describe, expect, test } from "bun:test";
import { firstValueFrom, of, toArray } from "rxjs";
import { AwsComprehendRedactor } from "../../lib/aws-comprehend/awsComprehendRedactor";

describe("AwsComprehendRedactor", () => {
    test("redacts detected PII entities with typed placeholders", async () => {
        const redactor = new AwsComprehendRedactor({
            client: {
                send: async () => ({
                    Entities: [
                        {
                            Type: "EMAIL",
                            Score: 0.99,
                            BeginOffset: 17,
                            EndOffset: 30,
                        },
                        {
                            Type: "PHONE",
                            Score: 0.97,
                            BeginOffset: 34,
                            EndOffset: 46,
                        },
                    ],
                }),
            },
            minScore: 0.9,
        });

        const result = await redactor.redact("Contact Alice at a@example.com or 555-010-2020.");

        expect(result.redactedPrompt).toBe("Contact Alice at [EMAIL] or [PHONE].");
        expect(result.entities).toEqual([
            {
                type: "EMAIL",
                score: 0.99,
                beginOffset: 17,
                endOffset: 30,
                text: "a@example.com",
            },
            {
                type: "PHONE",
                score: 0.97,
                beginOffset: 34,
                endOffset: 46,
                text: "555-010-2020",
            },
        ]);
    });

    test("filters by confidence and entity type", async () => {
        const redactor = new AwsComprehendRedactor({
            client: {
                send: async () => ({
                    Entities: [
                        { Type: "EMAIL", Score: 0.89, BeginOffset: 0, EndOffset: 13 },
                        { Type: "NAME", Score: 0.99, BeginOffset: 18, EndOffset: 23 },
                    ],
                }),
            },
            entityTypes: ["NAME"],
            minScore: 0.95,
        });

        const result = await redactor.redact("x@example.com for Alice");

        expect(result.redactedPrompt).toBe("x@example.com for [NAME]");
        expect(result.entities.map((entity) => entity.type)).toEqual(["NAME"]);
    });

    test("supports observable prompt chains", async () => {
        const redactor = new AwsComprehendRedactor({
            client: {
                send: async () => ({
                    Entities: [{ Type: "NAME", Score: 0.98, BeginOffset: 3, EndOffset: 8 }],
                }),
            },
            redactionMode: "mask",
        });

        const results = await firstValueFrom(
            redactor.redactObservable(of("Hi Alice", { prompt: "Hi Alice" })).pipe(toArray())
        );

        expect(results.map((result) => result.redactedPrompt)).toEqual(["Hi *****", "Hi *****"]);
    });
});

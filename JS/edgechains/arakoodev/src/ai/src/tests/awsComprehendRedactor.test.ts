import { describe, expect, test } from "vitest";
import {
    AwsComprehendRedactor,
    ComprehendClient,
    fromPrompts,
} from "../lib/aws-comprehend/awsComprehendRedactor";

const client: ComprehendClient = {
    async detectPiiEntities() {
        return {
            Entities: [
                { Type: "NAME", Score: 0.99, BeginOffset: 6, EndOffset: 16 },
                { Type: "EMAIL", Score: 0.98, BeginOffset: 20, EndOffset: 36 },
                { Type: "PHONE", Score: 0.2, BeginOffset: 40, EndOffset: 52 },
            ],
        };
    },
};

describe("AwsComprehendRedactor", () => {
    test("redacts supported PII using typed placeholders", async () => {
        const redactor = new AwsComprehendRedactor({ client });

        const result = await redactor.redact("Hello Jane Smith at jane@example.com or 415-555-1212");

        expect(result.redactedText).toBe("Hello [REDACTED_NAME] at [REDACTED_EMAIL] or 415-555-1212");
        expect(result.entities.map((entity) => entity.Type)).toEqual(["NAME", "EMAIL"]);
    });

    test("filters by entity type", async () => {
        const redactor = new AwsComprehendRedactor({ client });

        const result = await redactor.redact("Hello Jane Smith at jane@example.com", {
            entityTypes: ["EMAIL"],
        });

        expect(result.redactedText).toBe("Hello Jane Smith at [REDACTED_EMAIL]");
    });

    test("chains redacted prompt into endpoint calls", async () => {
        const redactor = new AwsComprehendRedactor({ client });

        const response = await redactor.chain("Hello Jane Smith at jane@example.com", async (prompt) => {
            return `endpoint saw: ${prompt}`;
        });

        expect(response).toBe("endpoint saw: Hello [REDACTED_NAME] at [REDACTED_EMAIL]");
    });

    test("redacts an observable prompt stream without rxjs", async () => {
        const redactor = new AwsComprehendRedactor({ client });
        const results: string[] = [];

        await new Promise<void>((resolve, reject) => {
            redactor.redactObservable(fromPrompts(["Hello Jane Smith at jane@example.com"])).subscribe({
                next: (result) => results.push(result.redactedText),
                error: reject,
                complete: resolve,
            });
        });

        expect(results).toEqual(["Hello [REDACTED_NAME] at [REDACTED_EMAIL]"]);
    });
});

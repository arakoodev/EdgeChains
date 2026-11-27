import { describe, it, expect, vi } from "vitest";
import { of, firstValueFrom, toArray } from "rxjs";
import {
    DetectPiiEntitiesCommand,
    DetectPiiEntitiesCommandOutput,
    PiiEntity,
    PiiEntityType,
} from "@aws-sdk/client-comprehend";
import {
    AwsComprehendRedactor,
    ComprehendCommandClient,
} from "../lib/aws-comprehend/awsComprehendRedactor.js";

function createMockClient(entities: PiiEntity[]): {
    client: ComprehendCommandClient;
    send: ReturnType<typeof vi.fn>;
} {
    const send = vi.fn(
        async (_command: DetectPiiEntitiesCommand): Promise<DetectPiiEntitiesCommandOutput> => ({
            $metadata: {},
            Entities: entities,
        })
    );
    return { client: { send }, send };
}

describe("AwsComprehendRedactor", () => {
    it("redacts multiple PII entities while preserving character offsets", async () => {
        const prompt = "Contact Jane Doe at jane@example.com or SSN 123-45-6789.";
        const { client, send } = createMockClient([
            { Type: PiiEntityType.NAME, Score: 0.99, BeginOffset: 8, EndOffset: 16 },
            { Type: PiiEntityType.EMAIL, Score: 0.98, BeginOffset: 20, EndOffset: 36 },
            { Type: PiiEntityType.SSN, Score: 0.97, BeginOffset: 44, EndOffset: 55 },
        ]);

        const redactor = new AwsComprehendRedactor({ client });
        const result = await redactor.redactText(prompt);

        expect(send).toHaveBeenCalledTimes(1);
        expect(result.redactedText).toBe(
            "Contact [REDACTED_NAME] at [REDACTED_EMAIL] or SSN [REDACTED_SSN]."
        );
        expect(result.originalText).toBe(prompt);
        expect(result.entities).toHaveLength(3);
    });

    it("short-circuits empty or whitespace prompts without invoking AWS", async () => {
        const { client, send } = createMockClient([]);
        const redactor = new AwsComprehendRedactor({ client });

        const result = await redactor.redactText("   ");
        expect(result.redactedText).toBe("   ");
        expect(result.entities).toEqual([]);
        expect(send).not.toHaveBeenCalled();
    });

    it("filters entities by minScore and entityTypes", async () => {
        const prompt = "Email jane@example.com from 10.0.0.1";
        const { client } = createMockClient([
            { Type: PiiEntityType.EMAIL, Score: 0.96, BeginOffset: 6, EndOffset: 22 },
            { Type: PiiEntityType.IP_ADDRESS, Score: 0.4, BeginOffset: 28, EndOffset: 36 },
        ]);

        const redactor = new AwsComprehendRedactor({
            client,
            minScore: 0.8,
            entityTypes: [PiiEntityType.EMAIL],
        });
        const result = await redactor.redactText(prompt);

        expect(result.redactedText).toBe("Email [REDACTED_EMAIL] from 10.0.0.1");
        expect(result.entities).toHaveLength(1);
    });

    it("handles overlapping spans without corrupting surrounding text", async () => {
        const prompt = "Account: john.doe@example.com active";
        const { client } = createMockClient([
            { Type: PiiEntityType.EMAIL, Score: 0.99, BeginOffset: 9, EndOffset: 29 },
            { Type: PiiEntityType.NAME, Score: 0.85, BeginOffset: 9, EndOffset: 17 },
        ]);

        const redactor = new AwsComprehendRedactor({ client });
        const result = await redactor.redactText(prompt);

        expect(result.redactedText).toBe("Account: [REDACTED_EMAIL] active");
    });

    it("supports custom mask formatting and rejects invalid minScore", async () => {
        expect(() => new AwsComprehendRedactor({ minScore: 1.5 })).toThrow(RangeError);
        expect(() => new AwsComprehendRedactor({ minScore: -0.1 })).toThrow(RangeError);

        const prompt = "Call 555-0199 now";
        const { client } = createMockClient([
            { Type: PiiEntityType.PHONE, Score: 0.95, BeginOffset: 5, EndOffset: 13 },
        ]);

        const redactor = new AwsComprehendRedactor({
            client,
            maskFormat: (type) => `<${type.toLowerCase()}>`,
        });
        const result = await redactor.redactText(prompt);
        expect(result.redactedText).toBe("Call <phone> now");
    });

    it("chains via asOperator() over an RxJS prompt stream", async () => {
        const { client } = createMockClient([
            { Type: PiiEntityType.EMAIL, Score: 0.99, BeginOffset: 5, EndOffset: 18 },
        ]);

        const redactor = new AwsComprehendRedactor({ client });
        const outputs = await firstValueFrom(
            of("Send a@example.com").pipe(redactor.asOperator(), toArray())
        );

        expect(outputs).toEqual(["Send [REDACTED_EMAIL]"]);
    });

    it("chains with an OpenAI-style endpoint via chainWithEndpoint()", async () => {
        const prompt = "My phone is 555-0199, please summarize my bill.";
        const { client } = createMockClient([
            { Type: PiiEntityType.PHONE, Score: 0.99, BeginOffset: 12, EndOffset: 20 },
        ]);

        const redactor = new AwsComprehendRedactor({ client });
        const mockOpenAiChat = vi.fn(async (redactedPrompt: string) => ({
            content: `Summary for: ${redactedPrompt}`,
        }));

        const response = await firstValueFrom(
            redactor.chainWithEndpoint(of(prompt), mockOpenAiChat)
        );

        expect(mockOpenAiChat).toHaveBeenCalledWith(
            "My phone is [REDACTED_PHONE], please summarize my bill."
        );
        expect(response.content).toBe(
            "Summary for: My phone is [REDACTED_PHONE], please summarize my bill."
        );
    });
});

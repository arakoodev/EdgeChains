import { ComprehendRedactor } from "../lib/comprehend/comprehendRedactor";
import { firstValueFrom } from "rxjs";

describe("ComprehendRedactor PII Redaction & Endpoint Chaining", () => {
    const createMockComprehendClient = (entities: any[]) => ({
        send: jest.fn().mockResolvedValue({ Entities: entities }),
    });

    test("should redact EMAIL, NAME, and PHONE entities using TAG mode by default", async () => {
        const prompt = "Hello, my name is Alice Smith and my email is alice@example.com.";
        const mockClient = createMockComprehendClient([
            { Type: "NAME", Score: 0.99, BeginOffset: 18, EndOffset: 29 },
            { Type: "EMAIL", Score: 0.99, BeginOffset: 46, EndOffset: 63 },
        ]);

        const redactor = new ComprehendRedactor({ client: mockClient as any });
        const result = await redactor.redactPrompt(prompt);

        expect(result.redactedText).toBe(
            "Hello, my name is [REDACTED_NAME] and my email is [REDACTED_EMAIL]."
        );
        expect(result.entitiesDetected).toHaveLength(2);
    });

    test("should support CHARACTER mask mode and filter by minConfidence and entityTypes", async () => {
        const prompt = "Call 555-1234 or email bob@work.org";
        const mockClient = createMockComprehendClient([
            { Type: "PHONE", Score: 0.95, BeginOffset: 5, EndOffset: 13 },
            { Type: "EMAIL", Score: 0.4, BeginOffset: 23, EndOffset: 35 }, // Below threshold
        ]);

        const redactor = new ComprehendRedactor({
            client: mockClient as any,
            minConfidence: 0.8,
            maskMode: "CHARACTER",
            maskCharacter: "*",
            entityTypes: ["PHONE"],
        });

        const result = await redactor.redactPrompt(prompt);
        expect(result.redactedText).toBe("Call ******** or email bob@work.org");
        expect(result.entitiesDetected).toHaveLength(1);
    });

    test("should chain as an Observable with an EdgeChains AI Endpoint (e.g., OpenAI)", async () => {
        const prompt = "Summarize account for SSN 123-45-6789.";
        const mockClient = createMockComprehendClient([
            { Type: "SSN", Score: 0.99, BeginOffset: 26, EndOffset: 37 },
        ]);

        const mockOpenAIEndpoint = {
            chat: jest.fn().mockImplementation(async (opts) => ({
                role: "assistant",
                content: `Processed sanitized prompt: ${opts.prompt}`,
            })),
        };

        const redactor = new ComprehendRedactor({ client: mockClient as any });
        const observablePipeline$ = redactor.chainWithEndpoint(mockOpenAIEndpoint, {
            prompt,
            model: "gpt-3.5-turbo",
        });

        const output = await firstValueFrom(observablePipeline$);

        expect(output.redaction.redactedText).toBe("Summarize account for SSN [REDACTED_SSN].");
        expect(mockOpenAIEndpoint.chat).toHaveBeenCalledWith({
            prompt: "Summarize account for SSN [REDACTED_SSN].",
            model: "gpt-3.5-turbo",
        });
        expect(output.llmResponse.content).toBe(
            "Processed sanitized prompt: Summarize account for SSN [REDACTED_SSN]."
        );
    });
});

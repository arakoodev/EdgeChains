import { describe, test, expect, vi } from "vitest";
import { firstValueFrom, of } from "rxjs";
import {
    AwsComprehendRedactor,
    AwsComprehendRedactionChain,
    redactPiiOperator,
    redactChatOptionsOperator,
} from "../index.js";

// Helper to create a mocked ComprehendClient
function createMockComprehendClient(entities: any[] = [], shouldFail: boolean = false) {
    return {
        send: vi.fn().mockImplementation(async (command: any) => {
            if (shouldFail) {
                throw new Error("AWS Comprehend Service Unavailable");
            }
            return {
                Entities: entities,
            };
        }),
    } as any;
}

describe("AwsComprehendRedactor", () => {
    test("should redact a single PII entity with ENTITY_TYPE mask", async () => {
        const text = "Hello, my name is John Doe.";
        const mockEntities = [
            {
                Type: "NAME",
                Score: 0.99,
                BeginOffset: 18,
                EndOffset: 26,
            },
        ];

        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            maskMode: "ENTITY_TYPE",
            enableRegexFallback: false,
        });

        const result = await redactor.redact(text);
        expect(result.redactedText).toBe("Hello, my name is [NAME].");
        expect(result.entitiesDetected.length).toBe(1);
        expect(result.entitiesDetected[0].type).toBe("NAME");
    });

    test("should redact multiple PII entities in descending order without index shifting", async () => {
        const text = "John Doe called from 555-123-4567 regarding SSN 123-45-6789.";
        const mockEntities = [
            {
                Type: "NAME",
                Score: 0.98,
                BeginOffset: 0,
                EndOffset: 8,
            },
            {
                Type: "PHONE",
                Score: 0.95,
                BeginOffset: 21,
                EndOffset: 33,
            },
            {
                Type: "SSN",
                Score: 0.99,
                BeginOffset: 48,
                EndOffset: 59,
            },
        ];

        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            maskMode: "ENTITY_TYPE",
            enableRegexFallback: false,
        });

        const result = await redactor.redact(text);
        expect(result.redactedText).toBe("[NAME] called from [PHONE] regarding SSN [SSN].");
        expect(result.entitiesDetected.length).toBe(3);
    });

    test("should support REDACTED_LABEL and ASTERISK masking modes", async () => {
        const text = "User John Doe registered.";
        const mockEntities = [
            {
                Type: "NAME",
                Score: 0.95,
                BeginOffset: 5,
                EndOffset: 13,
            },
        ];

        const labelRedactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            maskMode: "REDACTED_LABEL",
            enableRegexFallback: false,
        });
        const labelResult = await labelRedactor.redact(text);
        expect(labelResult.redactedText).toBe("User [REDACTED] registered.");

        const asteriskRedactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            maskMode: "ASTERISK",
            enableRegexFallback: false,
        });
        const asteriskResult = await asteriskRedactor.redact(text);
        expect(asteriskResult.redactedText).toBe("User ******** registered.");
    });

    test("should support CUSTOM mask function and custom string template", async () => {
        const text = "Contact John Doe today.";
        const mockEntities = [
            {
                Type: "NAME",
                Score: 0.95,
                BeginOffset: 8,
                EndOffset: 16,
            },
        ];

        const customFnRedactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            maskMode: "CUSTOM",
            customMask: (entity) => `<ANONYMIZED_${entity.type}>`,
            enableRegexFallback: false,
        });
        const fnResult = await customFnRedactor.redact(text);
        expect(fnResult.redactedText).toBe("Contact <ANONYMIZED_NAME> today.");

        const customStringRedactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            maskMode: "CUSTOM",
            customMask: "[CONFIDENTIAL]",
            enableRegexFallback: false,
        });
        const strResult = await customStringRedactor.redact(text);
        expect(strResult.redactedText).toBe("Contact [CONFIDENTIAL] today.");
    });

    test("should filter entities below confidence score threshold (minScore)", async () => {
        const text = "Check Alice and Bob.";
        const mockEntities = [
            {
                Type: "NAME",
                Score: 0.95,
                BeginOffset: 6,
                EndOffset: 11,
            },
            {
                Type: "NAME",
                Score: 0.40, // Below minScore 0.8
                BeginOffset: 16,
                EndOffset: 19,
            },
        ];

        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            minScore: 0.8,
            enableRegexFallback: false,
        });

        const result = await redactor.redact(text);
        expect(result.redactedText).toBe("Check [NAME] and Bob.");
        expect(result.entitiesDetected.length).toBe(1);
    });

    test("should respect entityTypes allowlist and excludeEntityTypes blocklist", async () => {
        const text = "Send Alice to 123 Main St.";
        const mockEntities = [
            {
                Type: "NAME",
                Score: 0.95,
                BeginOffset: 5,
                EndOffset: 10,
            },
            {
                Type: "ADDRESS",
                Score: 0.95,
                BeginOffset: 14,
                EndOffset: 25,
            },
        ];

        // Only allow ADDRESS
        const allowlistRedactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            entityTypes: ["ADDRESS"],
            enableRegexFallback: false,
        });
        const allowResult = await allowlistRedactor.redact(text);
        expect(allowResult.redactedText).toBe("Send Alice to [ADDRESS].");

        // Exclude NAME
        const blocklistRedactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            excludeEntityTypes: ["NAME"],
            enableRegexFallback: false,
        });
        const blockResult = await blocklistRedactor.redact(text);
        expect(blockResult.redactedText).toBe("Send Alice to [ADDRESS].");
    });

    test("should safely handle text containing Unicode / emojis", async () => {
        const text = "Hello 👋, my name is Alice Smith 🌟.";
        const mockEntities = [
            {
                Type: "NAME",
                Score: 0.99,
                BeginOffset: 21,
                EndOffset: 32,
            },
        ];

        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            enableRegexFallback: false,
        });

        const result = await redactor.redact(text);
        expect(result.redactedText).toBe("Hello 👋, my name is [NAME] 🌟.");
    });

    test("should fail-closed when Comprehend throws and failClosed is true", async () => {
        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient([], true),
            failClosed: true,
        });

        await expect(redactor.redact("My secret info")).rejects.toThrow(
            /Fail-closed: AWS Comprehend detection failed/
        );
    });

    test("should fallback to regex when Comprehend fails and failClosed is false", async () => {
        const text = "Reach me at secret@example.com or 123-45-6789.";
        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient([], true),
            failClosed: false,
            enableRegexFallback: true,
        });

        const result = await redactor.redact(text);
        expect(result.redactedText).toBe("Reach me at [EMAIL] or [SSN].");
    });

    test("should redact chat options (prompt and messages array)", async () => {
        const text = "My name is Alice.";
        const mockEntities = [
            { Type: "NAME", Score: 0.95, BeginOffset: text.indexOf("Alice"), EndOffset: text.indexOf("Alice") + "Alice".length },
        ];
        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            enableRegexFallback: false,
        });

        const chatOptions = {
            model: "gpt-4",
            prompt: "My name is Alice.",
            messages: [
                { role: "user", content: "My name is Alice." },
                { role: "assistant", content: "Hello Alice!" },
            ],
        };

        const sanitized = await redactor.redactChatOptions(chatOptions as any);
        expect(sanitized.prompt).toBe("My name is [NAME].");
        expect(sanitized.messages[0].content).toBe("My name is [NAME].");
        // Caller's original input must not be mutated
        expect(chatOptions.prompt).toBe("My name is Alice.");
    });
});

describe("AwsComprehendRedactionChain", () => {
    test("should chain with endpoint.chat() and pass sanitized prompt", async () => {
        const text = "Please email to alice@example.com for info.";
        const email = "alice@example.com";
        const mockEntities = [
            { Type: "EMAIL", Score: 0.99, BeginOffset: text.indexOf(email), EndOffset: text.indexOf(email) + email.length },
        ];
        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            enableRegexFallback: false,
        });

        const mockEndpoint = {
            chat: vi.fn().mockResolvedValue({ content: "Processed successfully" }),
        };

        const chain = new AwsComprehendRedactionChain(redactor, mockEndpoint);
        const response = await chain.chat({ prompt: "Please email to alice@example.com for info." });

        expect(mockEndpoint.chat).toHaveBeenCalledWith({
            prompt: "Please email to [EMAIL] for info.",
        });
        expect(response.content).toBe("Processed successfully");
    });

    test("should support RxJS Observable chat$() pipeline", async () => {
        const mockEntities = [
            { Type: "NAME", Score: 0.99, BeginOffset: 9, EndOffset: 12 },
        ];
        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            enableRegexFallback: false,
        });

        const mockEndpoint = {
            chat: vi.fn().mockResolvedValue({ content: "Hello [NAME]" }),
        };

        const chain = new AwsComprehendRedactionChain(redactor, mockEndpoint);

        const response$ = chain.chat$({ prompt: "Hello to Bob!" });
        const response = await firstValueFrom(response$);

        expect(mockEndpoint.chat).toHaveBeenCalledWith({ prompt: "Hello to [NAME]!" });
        expect(response.content).toBe("Hello [NAME]");
    });

    test("should support RxJS redact$() and redactPrompt$() observables", async () => {
        const mockEntities = [
            { Type: "PHONE", Score: 0.95, BeginOffset: 9, EndOffset: 21 },
        ];
        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            enableRegexFallback: false,
        });

        const chain = new AwsComprehendRedactionChain(redactor);

        const prompt = await firstValueFrom(chain.redactPrompt$("Call me: 555-555-5555 now"));
        expect(prompt).toBe("Call me: [PHONE] now");
    });

    test("should support redactPiiOperator in RxJS observable stream", async () => {
        const mockEntities = [
            { Type: "NAME", Score: 0.99, BeginOffset: 8, EndOffset: 13 },
        ];
        const redactor = new AwsComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            enableRegexFallback: false,
        });

        const source$ = of("Welcome Sarah to our service.");
        const clean$ = source$.pipe(redactPiiOperator(redactor));

        const result = await firstValueFrom(clean$);
        expect(result).toBe("Welcome [NAME] to our service.");
    });
});

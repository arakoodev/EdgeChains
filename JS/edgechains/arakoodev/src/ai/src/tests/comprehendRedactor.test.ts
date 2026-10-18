import { describe, it, expect, vi } from "vitest";
import {
    AWSComprehendRedactor,
} from "../lib/aws-comprehend/comprehendRedactor.js";

describe("AWSComprehendRedactor", () => {
    const mockEntities = [
        {
            Type: "EMAIL",
            Score: 0.99,
            BeginOffset: 12,
            EndOffset: 28, // "john@example.com"
        },
        {
            Type: "PHONE",
            Score: 0.95,
            BeginOffset: 42,
            EndOffset: 54, // "555-019-2834"
        },
    ];

    const sampleText = "My email is john@example.com and phone is 555-019-2834.";

    const createMockClient = (entities = mockEntities) => ({
        send: vi.fn().mockImplementation(async (command) => {
            if (command.input && command.input.Text && command.input.Text.includes("john@example.com")) {
                return { Entities: entities };
            }
            if (command.input && command.input.Text === "Some text") {
                return { Entities: entities };
            }
            return { Entities: [] };
        }),
    });

    it("should detect PII entities using AWS Comprehend", async () => {
        const mockClient: any = createMockClient();
        const redactor = new AWSComprehendRedactor({
            client: mockClient,
            confidenceThreshold: 0.8,
        });

        const detected = await redactor.detectPii(sampleText);
        expect(detected).toHaveLength(2);
        expect(detected[0].Type).toBe("EMAIL");
        expect(detected[1].Type).toBe("PHONE");
        expect(mockClient.send).toHaveBeenCalledTimes(1);
    });

    it("should filter out low confidence entities", async () => {
        const mixedEntities = [
            { Type: "EMAIL", Score: 0.95, BeginOffset: 0, EndOffset: 5 },
            { Type: "NAME", Score: 0.40, BeginOffset: 10, EndOffset: 15 },
        ];
        const mockClient: any = createMockClient(mixedEntities);
        const redactor = new AWSComprehendRedactor({
            client: mockClient,
            confidenceThreshold: 0.7,
        });

        const detected = await redactor.detectPii("Some text");
        expect(detected).toHaveLength(1);
        expect(detected[0].Type).toBe("EMAIL");
    });

    it("should redact PII using 'redact_label' mode (default)", async () => {
        const mockClient: any = createMockClient();
        const redactor = new AWSComprehendRedactor({ client: mockClient });

        const result = await redactor.redact(sampleText);
        expect(result.redactedText).toBe("My email is [EMAIL] and phone is [PHONE].");
        expect(result.entityCount).toBe(2);
    });

    it("should redact PII using 'placeholder' mode", async () => {
        const mockClient: any = createMockClient();
        const redactor = new AWSComprehendRedactor({
            client: mockClient,
            maskMode: "placeholder",
            placeholder: "<CONFIDENTIAL>",
        });

        const result = await redactor.redact(sampleText);
        expect(result.redactedText).toBe("My email is <CONFIDENTIAL> and phone is <CONFIDENTIAL>.");
    });

    it("should redact PII using 'mask' mode", async () => {
        const mockClient: any = createMockClient();
        const redactor = new AWSComprehendRedactor({
            client: mockClient,
            maskMode: "mask",
        });

        const result = await redactor.redact(sampleText);
        expect(result.redactedText).not.toContain("john@example.com");
        expect(result.redactedText).not.toContain("555-019-2834");
        expect(result.redactedText).toContain("*");
    });

    it("should handle empty or whitespace-only inputs gracefully", async () => {
        const mockClient: any = createMockClient();
        const redactor = new AWSComprehendRedactor({ client: mockClient });

        const res1 = await redactor.redact("");
        expect(res1.redactedText).toBe("");
        expect(res1.entityCount).toBe(0);

        const res2 = await redactor.redact("   ");
        expect(res2.redactedText).toBe("   ");
        expect(res2.entityCount).toBe(0);
        expect(mockClient.send).not.toHaveBeenCalled();
    });

    it("should chain with an LLM endpoint and redact prompt automatically", async () => {
        const mockClient: any = createMockClient();
        const redactor = new AWSComprehendRedactor({ client: mockClient });

        const mockEndpoint = {
            chat: vi.fn().mockImplementation(async (opts) => `AI Response to: ${opts.prompt}`),
        };

        const securedEndpoint = redactor.chain(mockEndpoint);

        const response = await securedEndpoint.chat({
            prompt: sampleText,
        });

        expect(mockEndpoint.chat).toHaveBeenCalledTimes(1);
        const calledArg = mockEndpoint.chat.mock.calls[0][0];
        expect(calledArg.prompt).toBe("My email is [EMAIL] and phone is [PHONE].");
        expect(response).toBe("AI Response to: My email is [EMAIL] and phone is [PHONE].");
    });

    it("should chain with an LLM endpoint and redact conversation messages", async () => {
        const mockClient: any = createMockClient();
        const redactor = new AWSComprehendRedactor({ client: mockClient });

        const mockEndpoint = {
            chat: vi.fn().mockImplementation(async (opts) => `Answer for ${opts.messages.length} msgs`),
        };

        const securedEndpoint = redactor.chain(mockEndpoint);

        await securedEndpoint.chat({
            messages: [
                { role: "user", content: sampleText },
                { role: "assistant", content: "Understood" },
            ],
        });

        const calledArg = mockEndpoint.chat.mock.calls[0][0];
        expect(calledArg.messages[0].content).toBe("My email is [EMAIL] and phone is [PHONE].");
        expect(calledArg.messages[1].content).toBe("Understood");
    });
});

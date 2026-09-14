/**
 * The AWS SDK needs Node globals (TextDecoder, ...) that jsdom does not provide.
 *
 * @jest-environment node
 */
import { DetectPiiEntitiesCommand, type ComprehendClient, type PiiEntity } from "@aws-sdk/client-comprehend";
import { ComprehendPiiRedactor, RedactionChain } from "../../lib/comprehend/comprehendRedactor.js";

const SAMPLE_TEXT = "My name is John Doe and my email is jane@example.com";
const SAMPLE_ENTITIES: any[] = [
    { Score: 0.99, Type: "NAME", BeginOffset: 11, EndOffset: 19 },
    { Score: 0.99, Type: "EMAIL", BeginOffset: 36, EndOffset: 52 },
];

function makeRedactor(entities: any[] = SAMPLE_ENTITIES, options: Record<string, any> = {}) {
    // mock Comprehend responding per prompt, like the real DetectPiiEntities API
    const send = jest.fn().mockImplementation((command: DetectPiiEntitiesCommand) =>
        Promise.resolve({ Entities: command.input.Text === SAMPLE_TEXT ? entities : [] })
    );
    const client = { send } as unknown as ComprehendClient;
    const redactor = new ComprehendPiiRedactor({ client, ...options });
    return { redactor, send };
}

describe("ComprehendPiiRedactor", () => {
    describe("detectPiiEntities", () => {
        it("should call DetectPiiEntities with the prompt and default language", async () => {
            const { redactor, send } = makeRedactor();

            const entities = await redactor.detectPiiEntities(SAMPLE_TEXT);

            expect(send).toHaveBeenCalledTimes(1);
            const command = send.mock.calls[0][0];
            expect(command).toBeInstanceOf(DetectPiiEntitiesCommand);
            expect(command.input.Text).toBe(SAMPLE_TEXT);
            expect(command.input.LanguageCode).toBe("en");
            expect(entities).toEqual(SAMPLE_ENTITIES);
        });

        it("should return no entities for empty text without calling Comprehend", async () => {
            const { redactor, send } = makeRedactor();

            const entities = await redactor.detectPiiEntities("");

            expect(entities).toEqual([]);
            expect(send).not.toHaveBeenCalled();
        });
    });

    describe("redact", () => {
        it("should replace detected PII with the entity type by default", async () => {
            const { redactor } = makeRedactor();

            const result = await redactor.redact(SAMPLE_TEXT);

            expect(result.redactedText).toBe("My name is [NAME] and my email is [EMAIL]");
            expect(result.entities.map((entity: PiiEntity) => entity.Type)).toEqual(["NAME", "EMAIL"]);
        });

        it("should mask PII with a character while preserving the original length", async () => {
            const { redactor } = makeRedactor(undefined, { maskMode: "MASK_WITH_CHAR" });

            const result = await redactor.redact(SAMPLE_TEXT);

            expect(result.redactedText).toBe("My name is ******** and my email is ****************");
        });

        it("should only redact the configured entity types", async () => {
            const { redactor } = makeRedactor(undefined, { entityTypes: ["EMAIL"] });

            const result = await redactor.redact(SAMPLE_TEXT);

            expect(result.redactedText).toBe("My name is John Doe and my email is [EMAIL]");
            expect(result.entities).toHaveLength(1);
            expect(result.entities[0].Type).toBe("EMAIL");
        });

        it("should support a custom replacement token with {TYPE}", async () => {
            const { redactor } = makeRedactor(undefined, { replacementToken: "<{TYPE}>" });

            const result = await redactor.redact(SAMPLE_TEXT);

            expect(result.redactedText).toBe("My name is <NAME> and my email is <EMAIL>");
        });

        it("should keep the original text when keepOriginal is enabled", async () => {
            const { redactor } = makeRedactor(undefined, { keepOriginal: true });

            const result = await redactor.redact(SAMPLE_TEXT);

            expect(result.redactedText).toBe("My name is [NAME] and my email is [EMAIL]");
            expect(result.originalText).toBe(SAMPLE_TEXT);
        });

        it("should let per-call overrides take precedence over the constructor config", async () => {
            const { redactor } = makeRedactor(undefined, { maskMode: "MASK_WITH_CHAR" });

            const result = await redactor.redact(SAMPLE_TEXT, { maskMode: "REPLACE_WITH_PII_ENTITY_TYPE" });

            expect(result.redactedText).toBe("My name is [NAME] and my email is [EMAIL]");
        });

        it("should collapse overlapping entities so spans are not redacted twice", async () => {
            const overlapping = [
                { Score: 0.99, Type: "ADDRESS", BeginOffset: 15, EndOffset: 19 },
                { Score: 0.99, Type: "NAME", BeginOffset: 11, EndOffset: 19 },
            ];
            const { redactor } = makeRedactor(overlapping);

            const result = await redactor.redact(SAMPLE_TEXT);

            expect(result.redactedText).toBe("My name is [NAME] and my email is jane@example.com");
        });
    });

    describe("normalizeEntities", () => {
        it("should sort entities by position", () => {
            const entities: any[] = [
                { Type: "EMAIL", BeginOffset: 36, EndOffset: 52 },
                { Type: "NAME", BeginOffset: 11, EndOffset: 19 },
            ];

            const normalized = ComprehendPiiRedactor.normalizeEntities(entities as PiiEntity[]);

            expect(normalized.map((entity) => entity.Type)).toEqual(["NAME", "EMAIL"]);
        });
    });

    describe("subscribe", () => {
        it("should notify observers of every redaction until unsubscribed", async () => {
            const { redactor } = makeRedactor();
            const listener = jest.fn();
            const unsubscribe = redactor.subscribe(listener);

            await redactor.redact(SAMPLE_TEXT);
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener.mock.calls[0][0].redactedText).toBe("My name is [NAME] and my email is [EMAIL]");

            unsubscribe();
            await redactor.redact(SAMPLE_TEXT);
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
});

describe("RedactionChain", () => {
    it("should redact the prompt before delegating to the endpoint chat", async () => {
        const { redactor } = makeRedactor();
        const endpoint = { chat: jest.fn().mockResolvedValue({ content: "ok" }) };
        const chain = new RedactionChain(endpoint as any, redactor);

        const response = await chain.chat({ prompt: SAMPLE_TEXT });

        expect(endpoint.chat).toHaveBeenCalledWith({
            prompt: "My name is [NAME] and my email is [EMAIL]",
        });
        expect(response).toEqual({ content: "ok" });
        expect(chain.redactions?.redactedText).toBe("My name is [NAME] and my email is [EMAIL]");
    });

    it("should redact every message content before delegating to the endpoint chat", async () => {
        const { redactor } = makeRedactor();
        const endpoint = { chat: jest.fn().mockResolvedValue({ content: "ok" }) };
        const chain = redactor.chain(endpoint as any);

        await chain.chat({
            messages: [
                { role: "user", content: SAMPLE_TEXT },
                { role: "assistant", content: "No PII here" },
            ],
        });

        expect(endpoint.chat).toHaveBeenCalledWith({
            messages: [
                { role: "user", content: "My name is [NAME] and my email is [EMAIL]" },
                { role: "assistant", content: "No PII here" },
            ],
        });
    });

    it("should forward non-string fields untouched", async () => {
        const { redactor } = makeRedactor();
        const endpoint = { chat: jest.fn().mockResolvedValue({ content: "ok" }) };
        const chain = redactor.chain(endpoint as any);

        await chain.chat({ prompt: SAMPLE_TEXT, model: "gpt-3.5-turbo", temperature: 0.7 });

        expect(endpoint.chat).toHaveBeenCalledWith({
            prompt: "My name is [NAME] and my email is [EMAIL]",
            model: "gpt-3.5-turbo",
            temperature: 0.7,
        });
    });

    it("should notify observers registered through the chain", async () => {
        const { redactor } = makeRedactor();
        const endpoint = { chat: jest.fn().mockResolvedValue({ content: "ok" }) };
        const chain = redactor.chain(endpoint as any);
        const listener = jest.fn();
        chain.subscribe(listener);

        await chain.chat({ prompt: SAMPLE_TEXT });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].entities).toHaveLength(2);
    });
});

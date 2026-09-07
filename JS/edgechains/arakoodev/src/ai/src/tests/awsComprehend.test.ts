import { DetectPiiEntitiesCommand, type PiiEntity } from "@aws-sdk/client-comprehend";
import { describe, expect, it, vi } from "vitest";
import {
    AWSComprehend,
    ComprehendPIIRedactor,
    pipe,
} from "../lib/aws-comprehend/aws-comprehend.js";

const SAMPLE = "My name is John Smith, SSN 123-45-6789";

function entitiesForSample(): PiiEntity[] {
    return [
        { Score: 0.99, Type: "NAME", BeginOffset: 11, EndOffset: 21 },
        { Score: 0.99, Type: "SSN", BeginOffset: 27, EndOffset: 38 },
    ];
}

function createRedactor(
    send = vi.fn().mockResolvedValue({ Entities: entitiesForSample() }),
    options: ConstructorParameters<typeof AWSComprehend>[0] = {}
) {
    return {
        send,
        redactor: new AWSComprehend({ client: { send }, ...options }),
    };
}

describe("AWSComprehend", () => {
    it("skips Amazon Comprehend when the text is empty", async () => {
        const { send, redactor } = createRedactor();
        const result = await redactor.redact("");

        expect(send).not.toHaveBeenCalled();
        expect(result).toEqual({ entities: [], redactedText: "", text: "" });
    });

    it("detects PII entities through DetectPiiEntities", async () => {
        const { send, redactor } = createRedactor();
        const entities = await redactor.detectPiiEntities(SAMPLE);

        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBeInstanceOf(DetectPiiEntitiesCommand);
        expect(send.mock.calls[0][0].input).toMatchObject({
            LanguageCode: "en",
            Text: SAMPLE,
        });
        expect(entities).toHaveLength(2);
        expect(entities.map((entity) => entity.Type)).toEqual(["NAME", "SSN"]);
    });

    it("filters entities below minScore", async () => {
        const send = vi.fn().mockResolvedValue({
            Entities: [
                { Score: 0.4, Type: "NAME", BeginOffset: 11, EndOffset: 21 },
                { Score: 0.99, Type: "SSN", BeginOffset: 27, EndOffset: 38 },
            ],
        });
        const redactor = new AWSComprehend({ client: { send }, minScore: 0.5 });
        const entities = await redactor.detectPiiEntities(SAMPLE);

        expect(entities).toHaveLength(1);
        expect(entities[0].Type).toBe("SSN");
    });

    it("filters entities by type", async () => {
        const { redactor } = createRedactor(undefined, { entityTypes: ["SSN"] });
        const entities = await redactor.detectPiiEntities(SAMPLE);

        expect(entities).toHaveLength(1);
        expect(entities[0].Type).toBe("SSN");
    });

    it("ignores entities that are missing offsets", async () => {
        const send = vi.fn().mockResolvedValue({
            Entities: [
                { Score: 0.99, Type: "NAME" },
                { Score: 0.99, Type: "SSN", BeginOffset: 27, EndOffset: 38 },
            ],
        });
        const redactor = new AWSComprehend({ client: { send } });
        const entities = await redactor.detectPiiEntities(SAMPLE);

        expect(entities).toHaveLength(1);
        expect(entities[0].Type).toBe("SSN");
    });

    it("redacts with PII entity type placeholders by default", async () => {
        const { redactor } = createRedactor();
        const result = await redactor.redact(SAMPLE);

        expect(result.redactedText).toBe("My name is [NAME], SSN [SSN]");
        expect(result.text).toBe(SAMPLE);
        expect(result.entities).toHaveLength(2);
    });

    it("masks PII in place while preserving span length", async () => {
        const { redactor } = createRedactor(undefined, { maskMode: "MASK" });
        const redacted = await redactor.redactPrompt(SAMPLE);

        expect(redacted).toBe("My name is **********, SSN ***********");
        expect(redacted.length).toBe(SAMPLE.length);
    });

    it("uses a custom mask character", async () => {
        const { redactor } = createRedactor(undefined, {
            maskMode: "MASK",
            maskCharacter: "#",
        });
        const redacted = await redactor.redactPrompt(SAMPLE);

        expect(redacted).toBe("My name is ##########, SSN ###########");
    });

    it("applies a custom replacement string", async () => {
        const { redactor } = createRedactor(undefined, { replacement: "[REDACTED]" });
        const redacted = await redactor.redactPrompt(SAMPLE);

        expect(redacted).toBe("My name is [REDACTED], SSN [REDACTED]");
    });

    it("applies a custom replacement function", async () => {
        const { redactor } = createRedactor(undefined, {
            replacement: (entity) => `<${entity.Type}>`,
        });
        const redacted = await redactor.redactPrompt(SAMPLE);

        expect(redacted).toBe("My name is <NAME>, SSN <SSN>");
    });

    it("reports whether text contains PII", async () => {
        const { redactor } = createRedactor();
        await expect(redactor.containsPii(SAMPLE)).resolves.toBe(true);

        const empty = createRedactor(vi.fn().mockResolvedValue({ Entities: [] }));
        await expect(empty.redactor.containsPii("hello there")).resolves.toBe(false);
    });

    it("redacts prompt strings and chat messages together", async () => {
        const { redactor } = createRedactor();
        const options = await redactor.redactPromptOptions({
            prompt: SAMPLE,
            temperature: 0.2,
            messages: [
                { role: "user", content: SAMPLE },
                { role: "system", content: 42 as unknown as string },
            ],
        });

        expect(options.temperature).toBe(0.2);
        expect(options.prompt).toBe("My name is [NAME], SSN [SSN]");
        expect(options.messages?.[0].content).toBe("My name is [NAME], SSN [SSN]");
        expect(options.messages?.[1].content).toBe(42);
    });

    it("redacts embedding input arrays", async () => {
        const { redactor } = createRedactor();
        const options = await redactor.redactPromptOptions({
            model: "text-embedding-ada-002",
            input: [SAMPLE, "no pii here"],
        });

        expect(options.input).toEqual(["My name is [NAME], SSN [SSN]", "no pii here"]);
    });

    it("chains with an existing endpoint chat() method", async () => {
        const { redactor } = createRedactor();
        const chat = vi.fn().mockResolvedValue({ content: "ok" });
        const endpoint = {
            apiKey: "test",
            chat,
            ping() {
                return this.apiKey;
            },
        };

        const chained = redactor.chain(endpoint);
        const response = await chained.chat({ prompt: SAMPLE, temperature: 0.1 });

        expect(response).toEqual({ content: "ok" });
        expect(chat).toHaveBeenCalledWith({
            prompt: "My name is [NAME], SSN [SSN]",
            temperature: 0.1,
        });
        expect(chained.ping()).toBe("test");
    });

    it("redacts string arguments passed to gptFn-style endpoint methods", async () => {
        const { redactor } = createRedactor();
        const gptFn = vi.fn().mockResolvedValue("answer");
        const chained = redactor.chain({ gptFn });

        await chained.gptFn(SAMPLE);

        expect(gptFn).toHaveBeenCalledWith("My name is [NAME], SSN [SSN]");
    });

    it("pipes redaction into an endpoint the same way other async chains work", async () => {
        const { redactor } = createRedactor();
        const openai = {
            chat: vi.fn(async ({ prompt }: { prompt: string }) => ({ content: prompt })),
        };

        const response = await pipe(
            SAMPLE,
            redactor.asOperator(),
            (prompt) => openai.chat({ prompt })
        );

        expect(response).toEqual({ content: "My name is [NAME], SSN [SSN]" });
    });

    it("exposes asPromptOperator for endpoint option objects", async () => {
        const { redactor } = createRedactor();
        const openai = {
            chat: vi.fn(async (options: { prompt: string }) => options.prompt),
        };

        const response = await pipe(
            { prompt: SAMPLE, max_tokens: 16 },
            redactor.asPromptOperator(),
            (options) => openai.chat(options as { prompt: string })
        );

        expect(response).toBe("My name is [NAME], SSN [SSN]");
        expect(openai.chat).toHaveBeenCalledWith({
            prompt: "My name is [NAME], SSN [SSN]",
            max_tokens: 16,
        });
    });

    it("keeps ComprehendPIIRedactor as a compatibility alias", () => {
        expect(new ComprehendPIIRedactor({ client: { send: vi.fn() } })).toBeInstanceOf(
            AWSComprehend
        );
    });
});

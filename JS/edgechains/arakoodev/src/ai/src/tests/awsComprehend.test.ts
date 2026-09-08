import {
    ContainsPiiEntitiesCommand,
    DetectPiiEntitiesCommand,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";
import { describe, expect, it, vi } from "vitest";
import {
    AWSComprehend,
    ComprehendPIIRedactor,
    PII_ENTITY_CATEGORIES,
    applyRedactions,
    codePointOffsetToUtf16Index,
    pipe,
    resolveOverlappingEntities,
    splitTextByUtf8ByteLimit,
} from "../lib/comprehend/index.js";
import { locateEntities } from "../lib/comprehend/apply-redaction.js";

const SAMPLE = "My name is John Smith, SSN 123-45-6789";

function entitiesForSample(): PiiEntity[] {
    return [
        { Score: 0.99, Type: "NAME", BeginOffset: 11, EndOffset: 21 },
        { Score: 0.99, Type: "SSN", BeginOffset: 27, EndOffset: 38 },
    ];
}

function labelsForSample() {
    return [
        { Name: "NAME", Score: 0.99 },
        { Name: "SSN", Score: 0.99 },
    ];
}

function createSend(
    entities: PiiEntity[] = entitiesForSample(),
    labels = labelsForSample()
) {
    return vi.fn().mockImplementation(async (command: unknown) => {
        if (command instanceof ContainsPiiEntitiesCommand) {
            return { Labels: labels };
        }
        return { Entities: entities };
    });
}

function createRedactor(
    send = createSend(),
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
        expect(result).toEqual({
            entities: [],
            labels: [],
            redactedText: "",
            skippedDetection: true,
            text: "",
        });
    });

    it("uses ContainsPiiEntities as the cheap first pass", async () => {
        const { send, redactor } = createRedactor();
        const result = await redactor.containsPii(SAMPLE);

        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBeInstanceOf(ContainsPiiEntitiesCommand);
        expect(send.mock.calls[0][0].input).toMatchObject({
            LanguageCode: "en",
            Text: SAMPLE,
        });
        expect(result.containsPii).toBe(true);
        expect(result.labels.map((label) => label.Name)).toEqual(["NAME", "SSN"]);
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

    it("skips DetectPiiEntities when ContainsPiiEntities finds nothing", async () => {
        const send = createSend([], []);
        const redactor = new AWSComprehend({ client: { send } });
        const result = await redactor.redact("no personal data here");

        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBeInstanceOf(ContainsPiiEntitiesCommand);
        expect(result.skippedDetection).toBe(true);
        expect(result.redactedText).toBe("no personal data here");
        expect(result.entities).toEqual([]);
    });

    it("runs DetectPiiEntities only after ContainsPiiEntities finds labels", async () => {
        const { send, redactor } = createRedactor();
        const result = await redactor.redact(SAMPLE);

        expect(send.mock.calls.map((call) => call[0].constructor.name)).toEqual([
            "ContainsPiiEntitiesCommand",
            "DetectPiiEntitiesCommand",
        ]);
        expect(result.skippedDetection).toBe(false);
        expect(result.redactedText).toBe("My name is [NAME], SSN [SSN]");
        expect(result.labels.map((label) => label.Name)).toEqual(["NAME", "SSN"]);
    });

    it("can disable the ContainsPiiEntities preflight", async () => {
        const { send, redactor } = createRedactor(undefined, { preflight: false });
        await redactor.redact(SAMPLE);

        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBeInstanceOf(DetectPiiEntitiesCommand);
    });

    it("filters entities below minScore", async () => {
        const send = createSend([
            { Score: 0.4, Type: "NAME", BeginOffset: 11, EndOffset: 21 },
            { Score: 0.99, Type: "SSN", BeginOffset: 27, EndOffset: 38 },
        ]);
        const redactor = new AWSComprehend({ client: { send }, minScore: 0.5, preflight: false });
        const entities = await redactor.detectPiiEntities(SAMPLE);

        expect(entities).toHaveLength(1);
        expect(entities[0].Type).toBe("SSN");
    });

    it("filters entities by type", async () => {
        const { redactor } = createRedactor(undefined, { entityTypes: ["SSN"], preflight: false });
        const entities = await redactor.detectPiiEntities(SAMPLE);

        expect(entities).toHaveLength(1);
        expect(entities[0].Type).toBe("SSN");
    });

    it("skips detection when preflight labels are outside the requested entity types", async () => {
        const send = createSend(entitiesForSample(), [{ Name: "EMAIL", Score: 0.99 }]);
        const redactor = new AWSComprehend({
            client: { send },
            entityTypes: ["SSN"],
        });
        const result = await redactor.redact(SAMPLE);

        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBeInstanceOf(ContainsPiiEntitiesCommand);
        expect(result.entities).toEqual([]);
        expect(result.redactedText).toBe(SAMPLE);
    });

    it("ignores entities that are missing offsets", async () => {
        const send = createSend([
            { Score: 0.99, Type: "NAME" },
            { Score: 0.99, Type: "SSN", BeginOffset: 27, EndOffset: 38 },
        ]);
        const redactor = new AWSComprehend({ client: { send }, preflight: false });
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

    it("keeps the longer span when two PII entities overlap", async () => {
        const text = "John Smith lives at 1 Main St";
        const send = createSend([
            { Score: 0.9, Type: "NAME", BeginOffset: 0, EndOffset: 10 },
            { Score: 0.95, Type: "ADDRESS", BeginOffset: 0, EndOffset: 29 },
        ]);
        const redactor = new AWSComprehend({ client: { send }, preflight: false });
        const redacted = await redactor.redactPrompt(text);

        expect(redacted).toBe("[ADDRESS]");
        expect(redacted).not.toContain("John");
    });

    it("redacts a conversation transcript turn by turn", async () => {
        const send = vi.fn().mockImplementation(async (command: unknown) => {
            const text =
                command &&
                typeof command === "object" &&
                "input" in command &&
                command.input &&
                typeof command.input === "object" &&
                "Text" in command.input
                    ? String((command.input as { Text?: string }).Text || "")
                    : "";

            if (command instanceof ContainsPiiEntitiesCommand) {
                if (text.includes("John Stiles")) {
                    return { Labels: [{ Name: "NAME", Score: 0.99 }] };
                }
                if (text.includes("555-456-7890")) {
                    return { Labels: [{ Name: "PHONE", Score: 0.99 }] };
                }
                return { Labels: [] };
            }

            if (text.includes("John Stiles")) {
                const begin = text.indexOf("John Stiles");
                return {
                    Entities: [
                        {
                            Score: 0.99,
                            Type: "NAME",
                            BeginOffset: begin,
                            EndOffset: begin + "John Stiles".length,
                        },
                    ],
                };
            }
            if (text.includes("555-456-7890")) {
                const begin = text.indexOf("555-456-7890");
                return {
                    Entities: [
                        {
                            Score: 0.99,
                            Type: "PHONE",
                            BeginOffset: begin,
                            EndOffset: begin + "555-456-7890".length,
                        },
                    ],
                };
            }
            return { Entities: [] };
        });
        const redactor = new AWSComprehend({ client: { send } });
        const result = await redactor.redactTranscript([
            { speaker: "Agent", text: "Whom am I speaking with?" },
            { speaker: "Caller", text: "Hello, my name is John Stiles." },
            { speaker: "Agent", text: "The number we have on file is 555-456-7890." },
        ]);

        expect(result.turns[0].text).toBe("Whom am I speaking with?");
        expect(result.turns[1].text).toBe("Hello, my name is [NAME].");
        expect(result.turns[2].text).toBe("The number we have on file is [PHONE].");
        expect(result.entities.map((entity) => entity.Type)).toEqual(["NAME", "PHONE"]);
    });

    it("wraps AWS errors with a Comprehend-specific message", async () => {
        const send = vi.fn().mockRejectedValue(new Error("ExpiredToken"));
        const redactor = new AWSComprehend({ client: { send }, preflight: false });

        await expect(redactor.redact(SAMPLE)).rejects.toThrow(
            "Amazon Comprehend DetectPiiEntities failed: ExpiredToken"
        );
    });

    it("honors a per-call language override", async () => {
        const { send, redactor } = createRedactor();
        await redactor.detectPiiEntities({ text: SAMPLE, languageCode: "es" });

        expect(send.mock.calls[0][0].input.LanguageCode).toBe("es");
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

    it("exports the PII categories from the Comprehend blog", () => {
        expect(PII_ENTITY_CATEGORIES.NATIONAL).toContain("SSN");
        expect(PII_ENTITY_CATEGORIES.PERSONAL).toContain("EMAIL");
    });

    it("redacts gptFnChat-style message arrays passed as the first argument", async () => {
        const { redactor } = createRedactor();
        const gptFnChat = vi.fn().mockResolvedValue("answer");
        const chained = redactor.chain({ gptFnChat });

        await chained.gptFnChat([
            { role: "system", content: "You are helpful" },
            { role: "user", content: SAMPLE },
        ]);

        expect(gptFnChat).toHaveBeenCalledWith([
            { role: "system", content: "You are helpful" },
            { role: "user", content: "My name is [NAME], SSN [SSN]" },
        ]);
    });

    it("redacts string arrays passed as the first chain argument", async () => {
        const { redactor } = createRedactor();
        const embeddings = vi.fn().mockResolvedValue([]);
        const chained = redactor.chain({ embeddings });

        await chained.embeddings([SAMPLE, "no pii here"]);

        expect(embeddings).toHaveBeenCalledWith(["My name is [NAME], SSN [SSN]", "no pii here"]);
    });

    it("maps Comprehend code-point offsets past emoji onto UTF-16 slice indices", async () => {
        const text = "😀 SSN 123-45-6789";
        const send = createSend(
            [{ Score: 0.99, Type: "SSN", BeginOffset: 6, EndOffset: 17 }],
            [{ Name: "SSN", Score: 0.99 }]
        );
        const redactor = new AWSComprehend({ client: { send } });
        const redacted = await redactor.redactPrompt(text);

        expect(redacted).toBe("😀 SSN [SSN]");
        expect(redacted).not.toContain("123-45-6789");
        expect(redacted.startsWith("😀")).toBe(true);
    });

    it("keeps PII intact when several astral characters precede the entity", async () => {
        const text = "👨‍👩‍👧‍👦 contact Jane at 555-0100";
        const janeCodePointOffset = [...text].indexOf("J");
        const jane = "Jane";
        const send = createSend(
            [
                {
                    Score: 0.99,
                    Type: "NAME",
                    BeginOffset: janeCodePointOffset,
                    EndOffset: janeCodePointOffset + [...jane].length,
                },
            ],
            [{ Name: "NAME", Score: 0.99 }]
        );
        const redactor = new AWSComprehend({ client: { send } });
        const redacted = await redactor.redactPrompt(text);

        expect(redacted).toContain("[NAME]");
        expect(redacted).not.toContain("Jane");
        expect(redacted.startsWith("👨‍👩‍👧‍👦")).toBe(true);
    });

    it("splits prompts over the DetectPiiEntities UTF-8 limit and rebases offsets", async () => {
        const prefix = "aaaaaaaaaa";
        const ssn = "123-45-6789";
        const text = `${prefix} ${ssn}`;
        const send = vi.fn().mockImplementation(async (command: { input?: { Text?: string } }) => {
            const chunk = command.input?.Text || "";
            if (command instanceof ContainsPiiEntitiesCommand) {
                return {
                    Labels: chunk.includes(ssn) ? [{ Name: "SSN", Score: 0.99 }] : [],
                };
            }
            if (chunk.includes(ssn)) {
                const begin = chunk.indexOf(ssn);
                return {
                    Entities: [
                        {
                            Score: 0.99,
                            Type: "SSN",
                            BeginOffset: begin,
                            EndOffset: begin + ssn.length,
                        },
                    ],
                };
            }
            return { Entities: [] };
        });
        const redactor = new AWSComprehend({ client: { send }, maxUtf8Bytes: 12 });
        const result = await redactor.redact(text);

        expect(send.mock.calls.length).toBeGreaterThan(1);
        expect(
            send.mock.calls.every(
                (call) =>
                    new TextEncoder().encode(call[0].input.Text).byteLength <= 12 ||
                    [...(call[0].input.Text as string)].length === 1
            )
        ).toBe(true);
        expect(result.redactedText).toBe(`${prefix} [SSN]`);
        expect(result.entities[0].BeginOffset).toBe(prefix.length + 1);
        expect(result.entities[0].EndOffset).toBe(prefix.length + 1 + ssn.length);
    });
});

describe("codePointOffsetToUtf16Index", () => {
    it("counts an emoji as one code point and two UTF-16 units", () => {
        const text = "😀 SSN 123-45-6789";
        expect(codePointOffsetToUtf16Index(text, 0)).toBe(0);
        expect(codePointOffsetToUtf16Index(text, 1)).toBe(2);
        expect(codePointOffsetToUtf16Index(text, 6)).toBe(7);
        expect(codePointOffsetToUtf16Index(text, 17)).toBe(18);
        expect(text.slice(7, 18)).toBe("123-45-6789");
        expect(codePointOffsetToUtf16Index(text, 100)).toBe(-1);
    });
});

describe("splitTextByUtf8ByteLimit", () => {
    it("does not split surrogate pairs and prefers whitespace", () => {
        const chunks = splitTextByUtf8ByteLimit("😀😀 hello", 9);
        expect(chunks.map((chunk) => chunk.text)).toEqual(["😀😀 ", "hello"]);
        expect(chunks[0].text).not.toMatch(/[\uD800-\uDBFF]$/);
        expect(chunks[1].codePointOffset).toBe(3);
    });
});

describe("resolveOverlappingEntities", () => {
    it("keeps the longer overlapping span", () => {
        const located = locateEntities("John Smith 1 Main St", [
            { Score: 0.8, Type: "NAME", BeginOffset: 0, EndOffset: 10 },
            { Score: 0.9, Type: "ADDRESS", BeginOffset: 0, EndOffset: 20 },
        ]);
        const resolved = resolveOverlappingEntities(located);
        expect(resolved).toHaveLength(1);
        expect(resolved[0].entity.Type).toBe("ADDRESS");
    });

    it("keeps non-overlapping spans", () => {
        const located = locateEntities(SAMPLE, entitiesForSample());
        expect(resolveOverlappingEntities(located)).toHaveLength(2);
    });
});

describe("applyRedactions", () => {
    it("replaces from the end so earlier offsets stay valid", () => {
        const redacted = applyRedactions(SAMPLE, entitiesForSample(), {
            maskCharacter: "*",
            maskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
        });
        expect(redacted).toBe("My name is [NAME], SSN [SSN]");
    });
});

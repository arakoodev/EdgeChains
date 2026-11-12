import { describe, expect, it, vi } from "vitest";
import {
  AWSComprehendPiiClient,
  AWSComprehendPiiEntity,
  AWSComprehendPiiEntityType,
  AWSComprehendRedactor,
} from "../lib/aws-comprehend/aws-comprehend-redactor.js";

describe("AWSComprehendRedactor", () => {
  it("redacts detected entities and returns useful metadata", async () => {
    const text = "Email jane@example.com or call 555-0100.";
    const client = mockClient([
      entityFor(text, "jane@example.com", "EMAIL"),
      entityFor(text, "555-0100", "PHONE"),
    ]);
    const redactor = new AWSComprehendRedactor({ client });

    const result = await redactor.redactText(text);

    expect(result.redactedText).toBe(
      "Email [REDACTED_EMAIL] or call [REDACTED_PHONE].",
    );
    expect(result.entities).toMatchObject([
      {
        Type: "EMAIL",
        Text: "jane@example.com",
        Replacement: "[REDACTED_EMAIL]",
      },
      { Type: "PHONE", Text: "555-0100", Replacement: "[REDACTED_PHONE]" },
    ]);
    expect(client.detectPiiEntities).toHaveBeenCalledWith({
      Text: text,
      LanguageCode: "en",
    });
  });

  it("filters by confidence and PII type", async () => {
    const text = "Jane can be reached at jane@example.com.";
    const client = mockClient([
      entityFor(text, "Jane", "NAME", 0.99),
      entityFor(text, "jane@example.com", "EMAIL", 0.93),
      entityFor(text, "Jane", "USERNAME", 0.2),
    ]);
    const redactor = new AWSComprehendRedactor({
      client,
      minScore: 0.9,
      redactTypes: ["EMAIL"],
    });

    await expect(redactor.redact(text)).resolves.toBe(
      "Jane can be reached at [REDACTED_EMAIL].",
    );
  });

  it("handles Comprehend code point offsets without corrupting unicode text", async () => {
    const text = "Customer 😀 Ada uses ada@example.com.";
    const client = mockClient([entityFor(text, "ada@example.com", "EMAIL")]);
    const redactor = new AWSComprehendRedactor({ client });

    await expect(redactor.redact(text)).resolves.toBe(
      "Customer 😀 Ada uses [REDACTED_EMAIL].",
    );
  });

  it("skips overlapping spans so redaction does not rewrite generated replacements", async () => {
    const text = "SSN 123-45-6789 was provided.";
    const client = mockClient([
      entityFor(text, "123-45-6789", "SSN", 0.98),
      entityFor(text, "123-45", "PIN", 0.99),
    ]);
    const redactor = new AWSComprehendRedactor({ client });

    const result = await redactor.redactText(text);

    expect(result.redactedText).toBe("SSN [REDACTED_SSN] was provided.");
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].Type).toBe("SSN");
  });

  it("redacts prompt and message chat options before endpoint calls", async () => {
    const text = "Contact jane@example.com";
    const client = mockClient([entityFor(text, "jane@example.com", "EMAIL")]);
    const redactor = new AWSComprehendRedactor({ client });
    const endpoint = {
      model: "demo",
      chat: vi.fn().mockResolvedValue({ content: "ok" }),
    };

    const wrappedEndpoint = redactor.chainEndpoint(endpoint);
    const result = await wrappedEndpoint.chat({
      prompt: text,
      messages: [{ role: "user", content: text }],
    });

    expect(result).toEqual({ content: "ok" });
    expect(wrappedEndpoint.model).toBe("demo");
    expect(endpoint.chat).toHaveBeenCalledWith({
      prompt: "Contact [REDACTED_EMAIL]",
      messages: [{ role: "user", content: "Contact [REDACTED_EMAIL]" }],
    });
  });

  it("exposes stream and function operators for observable-style chains", async () => {
    const text = "Send the update to jane@example.com";
    const client = mockClient([entityFor(text, "jane@example.com", "EMAIL")]);
    const redactor = new AWSComprehendRedactor({ client });
    const output: string[] = [];

    for await (const chunk of redactor.streamOperator()([text])) {
      output.push(chunk);
    }

    await expect(redactor.textOperator()(text)).resolves.toBe(
      "Send the update to [REDACTED_EMAIL]",
    );
    expect(output).toEqual(["Send the update to [REDACTED_EMAIL]"]);
  });

  it("allows custom replacement templates and functions", async () => {
    const text = "The account is 123456789.";
    const client = mockClient([
      entityFor(text, "123456789", "BANK_ACCOUNT_NUMBER"),
    ]);
    const redactor = new AWSComprehendRedactor({
      client,
      replacement: "<{type}>",
    });

    await expect(redactor.redact(text)).resolves.toBe(
      "The account is <BANK_ACCOUNT_NUMBER>.",
    );
    await expect(
      redactor.redact(text, {
        replacement: (entity) => `***${entity.Text.length}:${entity.Type}***`,
      }),
    ).resolves.toBe("The account is ***9:BANK_ACCOUNT_NUMBER***.");
  });
});

function mockClient(entities: AWSComprehendPiiEntity[]) {
  return {
    detectPiiEntities: vi.fn().mockResolvedValue({ Entities: entities }),
  } as unknown as AWSComprehendPiiClient & {
    detectPiiEntities: ReturnType<typeof vi.fn>;
  };
}

function entityFor(
  text: string,
  snippet: string,
  type: AWSComprehendPiiEntityType,
  score = 0.99,
): AWSComprehendPiiEntity {
  const start = text.indexOf(snippet);

  if (start < 0) {
    throw new Error(`Snippet not found: ${snippet}`);
  }

  const beginOffset = Array.from(text.slice(0, start)).length;
  const endOffset = beginOffset + Array.from(snippet).length;

  return {
    Type: type,
    Score: score,
    BeginOffset: beginOffset,
    EndOffset: endOffset,
  };
}

import { describe, expect, it, vi } from "vitest";
import {
  AWSComprehendPIIRedactor,
  ComprehendCompatibleClient,
} from "../lib/comprehend/comprehend";

function mockClient(): ComprehendCompatibleClient {
  return {
    detectPiiEntities: vi.fn(async ({ Text }) => {
      const name = "Jane Doe";
      const email = "jane@example.com";
      return {
        Entities: [
          {
            Type: "NAME",
            BeginOffset: Text.indexOf(name),
            EndOffset: Text.indexOf(name) + name.length,
            Score: 0.99,
          },
          {
            Type: "EMAIL",
            BeginOffset: Text.indexOf(email),
            EndOffset: Text.indexOf(email) + email.length,
            Score: 0.98,
          },
        ],
      };
    }),
  };
}

describe("AWSComprehendPIIRedactor", () => {
  it("redacts detected PII with entity labels", async () => {
    const redactor = new AWSComprehendPIIRedactor({ client: mockClient() });
    const result = await redactor.redact(
      "Contact Jane Doe at jane@example.com",
    );

    expect(result.redactedText).toBe("Contact [NAME] at [EMAIL]");
    expect(result.entities).toHaveLength(2);
  });

  it("can mask sensitive spans without shifting later offsets", () => {
    const result = AWSComprehendPIIRedactor.applyRedaction(
      "Call 555-1111 or email jane@example.com",
      [
        { Type: "PHONE", BeginOffset: 5, EndOffset: 13, Score: 0.99 },
        { Type: "EMAIL", BeginOffset: 23, EndOffset: 39, Score: 0.99 },
      ],
      { mode: "mask", maskChar: "x" },
    );

    expect(result).toBe("Call xxxxxxxx or email xxxxxxxxxxxxxxxx");
  });

  it("filters entities by confidence and type", () => {
    const result = AWSComprehendPIIRedactor.applyRedaction(
      "Jane uses 555-1111",
      [
        { Type: "NAME", BeginOffset: 0, EndOffset: 4, Score: 0.5 },
        { Type: "PHONE", BeginOffset: 10, EndOffset: 18, Score: 0.99 },
      ],
      { minScore: 0.9, entityTypes: ["PHONE"] },
    );

    expect(result).toBe("Jane uses [PHONE]");
  });

  it("redacts prompt and message chat options before calling an endpoint", async () => {
    const redactor = new AWSComprehendPIIRedactor({ client: mockClient() });
    const endpoint = {
      chat: vi.fn(async (options: { prompt?: string }) => ({
        content: options.prompt || "",
      })),
    };

    const result = await redactor.chat(endpoint, {
      prompt: "Contact Jane Doe at jane@example.com",
    });

    expect(endpoint.chat).toHaveBeenCalledWith({
      prompt: "Contact [NAME] at [EMAIL]",
    });
    expect(result.content).toBe("Contact [NAME] at [EMAIL]");
  });
});

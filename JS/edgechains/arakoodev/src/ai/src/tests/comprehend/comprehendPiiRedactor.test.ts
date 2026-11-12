import { describe, expect, it, vi } from "vitest";
import { ComprehendPiiRedactor } from "../../lib/comprehend/comprehendPiiRedactor.js";

describe("ComprehendPiiRedactor", () => {
  it("redacts PII entities with entity labels", async () => {
    const client = {
      send: vi.fn().mockResolvedValue({
        Entities: [
          {
            Type: "EMAIL",
            BeginOffset: 14,
            EndOffset: 27,
            Score: 0.99,
          },
          {
            Type: "PHONE",
            BeginOffset: 31,
            EndOffset: 43,
            Score: 0.98,
          },
        ],
      }),
    };
    const redactor = new ComprehendPiiRedactor({ client });

    const result = await redactor.redact(
      "Contact me at a@example.com or 555-010-9999.",
    );

    expect(result).toBe("Contact me at [EMAIL] or [PHONE].");
    expect(client.send).toHaveBeenCalledOnce();
    expect(client.send.mock.calls[0][0].input).toMatchObject({
      Text: "Contact me at a@example.com or 555-010-9999.",
      LanguageCode: "en",
    });
  });

  it("redacts prompt and chat message content", async () => {
    const client = {
      send: vi
        .fn()
        .mockResolvedValueOnce({
          Entities: [
            { Type: "NAME", BeginOffset: 6, EndOffset: 10, Score: 0.98 },
          ],
        })
        .mockResolvedValueOnce({
          Entities: [
            { Type: "EMAIL", BeginOffset: 6, EndOffset: 19, Score: 0.99 },
          ],
        }),
    };
    const redactor = new ComprehendPiiRedactor({ client });

    const result = await redactor.redactChatOptions({
      prompt: "Hello Jane",
      messages: [{ role: "user", content: "Email a@example.com" }],
      temperature: 0.2,
    });

    expect(result).toEqual({
      prompt: "Hello [NAME]",
      messages: [{ role: "user", content: "Email [EMAIL]" }],
      temperature: 0.2,
    });
  });

  it("wraps endpoint-style chat calls", async () => {
    const client = {
      send: vi.fn().mockResolvedValue({
        Entities: [
          { Type: "EMAIL", BeginOffset: 6, EndOffset: 19, Score: 0.99 },
        ],
      }),
    };
    const endpoint = {
      chat: vi.fn().mockResolvedValue({ content: "done" }),
    };
    const redactor = new ComprehendPiiRedactor({ client });
    const wrappedEndpoint = redactor.wrapEndpoint(endpoint);

    const result = await wrappedEndpoint.chat({
      prompt: "Email a@example.com",
    });

    expect(result).toEqual({ content: "done" });
    expect(endpoint.chat).toHaveBeenCalledWith({ prompt: "Email [EMAIL]" });
  });

  it("supports a chainable async operator", async () => {
    const client = {
      send: vi.fn().mockResolvedValue({
        Entities: [{ Type: "NAME", BeginOffset: 3, EndOffset: 7, Score: 0.99 }],
      }),
    };
    const redactor = new ComprehendPiiRedactor({ client });
    const redact = redactor.asOperator<string>();

    await expect(redact("Hi Jane")).resolves.toBe("Hi [NAME]");
  });
});

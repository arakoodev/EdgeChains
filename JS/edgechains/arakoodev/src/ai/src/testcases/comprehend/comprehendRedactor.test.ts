import { describe, expect, test } from "vitest";
import { ComprehendRedactor } from "../../lib/comprehend/comprehendRedactor.js";

class FakeComprehendClient {
  commands: any[] = [];

  constructor(private entities: any[]) {}

  async send(command: any): Promise<any> {
    this.commands.push(command);
    return { Entities: this.entities };
  }
}

describe("ComprehendRedactor", () => {
  test("detects PII entities with AWS Comprehend", async () => {
    const client = new FakeComprehendClient([
      { Type: "EMAIL", BeginOffset: 14, EndOffset: 30, Score: 0.99 },
    ]);
    const redactor = new ComprehendRedactor({ client });

    const entities = await redactor.detectPiiEntities(
      "Jane Doe uses jane@example.com",
    );

    expect(entities).toEqual([
      { Type: "EMAIL", BeginOffset: 14, EndOffset: 30, Score: 0.99 },
    ]);
    expect(client.commands).toHaveLength(1);
  });

  test("redacts detected PII entities with entity labels", async () => {
    const client = new FakeComprehendClient([
      { Type: "NAME", BeginOffset: 0, EndOffset: 8, Score: 0.99 },
      { Type: "EMAIL", BeginOffset: 14, EndOffset: 30, Score: 0.99 },
    ]);
    const redactor = new ComprehendRedactor({ client });

    const result = await redactor.redact("Jane Doe uses jane@example.com");

    expect(result.redactedText).toBe("[NAME] uses [EMAIL]");
  });

  test("supports custom replacement strings", async () => {
    const client = new FakeComprehendClient([
      { Type: "PHONE", BeginOffset: 8, EndOffset: 20, Score: 0.99 },
    ]);
    const redactor = new ComprehendRedactor({
      client,
      replacement: "[REDACTED]",
    });

    const redactedText = await redactor.redactText("Call me 555-123-4567");

    expect(redactedText).toBe("Call me [REDACTED]");
  });

  test("redacts prompt and message options before they are sent to an endpoint", async () => {
    const client = new FakeComprehendClient([
      { Type: "NAME", BeginOffset: 0, EndOffset: 8, Score: 0.99 },
    ]);
    const redactor = new ComprehendRedactor({ client });

    const options = await redactor.redactPromptOptions({
      prompt: "Jane Doe needs help",
      messages: [{ role: "user", content: "Jane Doe needs help" }],
    });

    expect(options.prompt).toBe("[NAME] needs help");
    expect(options.messages?.[0].content).toBe("[NAME] needs help");
  });

  test("wraps chat endpoints so redaction can be chained with LLM calls", async () => {
    const client = new FakeComprehendClient([
      { Type: "NAME", BeginOffset: 0, EndOffset: 8, Score: 0.99 },
    ]);
    const redactor = new ComprehendRedactor({ client });
    const endpoint = {
      chat: async (options: { prompt: string }) => options.prompt,
    };

    const safeEndpoint = redactor.wrapChat(endpoint);
    const response = await safeEndpoint.chat({ prompt: "Jane Doe needs help" });

    expect(response).toBe("[NAME] needs help");
  });
});

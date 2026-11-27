import { describe, test, expect, vi, beforeEach } from "vitest";
import { AwsComprehend } from "../lib/aws-comprehend/comprehend.js";
import { ComprehendRedactedEndpoint } from "../lib/aws-comprehend/redactedEndpoint.js";

const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-comprehend", () => {
  class FakeComprehendClient {
    send = mockSend;
  }
  class FakeDetectPiiEntitiesCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }
  return {
    ComprehendClient: FakeComprehendClient,
    DetectPiiEntitiesCommand: FakeDetectPiiEntitiesCommand,
  };
});

const text = "My name is John Doe and my email is john@example.com";
const nameEntity = {
  Type: "NAME",
  Score: 0.99,
  BeginOffset: text.indexOf("John Doe"),
  EndOffset: text.indexOf("John Doe") + "John Doe".length,
};
const emailEntity = {
  Type: "EMAIL",
  Score: 0.98,
  BeginOffset: text.indexOf("john@example.com"),
  EndOffset: text.indexOf("john@example.com") + "john@example.com".length,
};

function comprehendReturning(entities: any[]) {
  // The mocked Comprehend only "detects" the fixture entities in the
  // fixture text; any other text has no PII, like the real service.
  mockSend.mockImplementation(async (command: any) => ({
    Entities: command.input.Text === text ? entities : [],
  }));
  return new AwsComprehend({ region: "us-east-1" });
}

describe("AwsComprehend", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe("detectPiiEntities", () => {
    test("returns the entities reported by Comprehend", async () => {
      const comprehend = comprehendReturning([nameEntity, emailEntity]);
      const entities = await comprehend.detectPiiEntities(text);
      expect(entities).toEqual([nameEntity, emailEntity]);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({ Text: text, LanguageCode: "en" });
    });

    test("returns an empty array when Comprehend finds nothing", async () => {
      const comprehend = comprehendReturning([]);
      await expect(
        comprehend.detectPiiEntities("hello world"),
      ).resolves.toEqual([]);
    });
  });

  describe("redactPii", () => {
    test("replaces detected spans with [TYPE] labels by default", async () => {
      const comprehend = comprehendReturning([nameEntity, emailEntity]);
      const { redactedText, entities } = await comprehend.redactPii(text);
      expect(redactedText).toBe("My name is [NAME] and my email is [EMAIL]");
      expect(entities).toHaveLength(2);
    });

    test("masks with a repeated character when maskStyle is 'character'", async () => {
      const comprehend = comprehendReturning([emailEntity]);
      const { redactedText } = await comprehend.redactPii(text, {
        maskStyle: "character",
      });
      expect(redactedText).toBe(
        `My name is John Doe and my email is ${"*".repeat("john@example.com".length)}`,
      );
    });

    test("only redacts the entity types listed in entityTypes", async () => {
      const comprehend = comprehendReturning([nameEntity, emailEntity]);
      const { redactedText, entities } = await comprehend.redactPii(text, {
        entityTypes: ["EMAIL" as any],
      });
      expect(redactedText).toBe("My name is John Doe and my email is [EMAIL]");
      expect(entities).toEqual([emailEntity]);
    });

    test("skips entities below minScore", async () => {
      const comprehend = comprehendReturning([nameEntity, emailEntity]);
      const { redactedText } = await comprehend.redactPii(text, {
        minScore: 0.99,
      });
      expect(redactedText).toBe(
        "My name is [NAME] and my email is john@example.com",
      );
    });

    test("leaves the text untouched when nothing is detected", async () => {
      const comprehend = comprehendReturning([]);
      const { redactedText, entities } = await comprehend.redactPii(text);
      expect(redactedText).toBe(text);
      expect(entities).toEqual([]);
    });
  });

  describe("redactMessages", () => {
    test("redacts every message content and preserves roles", async () => {
      const comprehend = comprehendReturning([nameEntity, emailEntity]);
      const messages = [
        { role: "user", content: text },
        { role: "assistant", content: "Sure, I can help with that." },
      ];
      const redacted = await comprehend.redactMessages(messages as any);
      expect(redacted[0]).toEqual({
        role: "user",
        content: "My name is [NAME] and my email is [EMAIL]",
      });
      expect(redacted[1]).toEqual(messages[1]);
      // original messages are not mutated
      expect(messages[0].content).toBe(text);
    });
  });
});

describe("ComprehendRedactedEndpoint", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  test("redacts the prompt before delegating chat to the wrapped endpoint", async () => {
    const comprehend = comprehendReturning([nameEntity, emailEntity]);
    const innerChat = vi.fn().mockResolvedValue({ content: "ok" });
    const endpoint = new ComprehendRedactedEndpoint(
      { chat: innerChat },
      comprehend,
    );

    const response = await endpoint.chat({ prompt: text, model: "gpt-4" });

    expect(innerChat).toHaveBeenCalledTimes(1);
    expect(innerChat.mock.calls[0][0]).toEqual({
      prompt: "My name is [NAME] and my email is [EMAIL]",
      model: "gpt-4",
    });
    expect(response).toEqual({ content: "ok" });
  });

  test("redacts message contents before delegating chat", async () => {
    const comprehend = comprehendReturning([emailEntity]);
    const innerChat = vi.fn().mockResolvedValue({ content: "ok" });
    const endpoint = new ComprehendRedactedEndpoint(
      { chat: innerChat },
      comprehend,
    );

    await endpoint.chat({ messages: [{ role: "user", content: text }] });

    expect(innerChat.mock.calls[0][0].messages).toEqual([
      { role: "user", content: "My name is John Doe and my email is [EMAIL]" },
    ]);
  });

  test("AwsComprehend.chain returns a working redacted endpoint", async () => {
    const comprehend = comprehendReturning([nameEntity]);
    const innerChat = vi.fn().mockResolvedValue({ content: "ok" });
    const endpoint = comprehend.chain({ chat: innerChat });

    expect(endpoint).toBeInstanceOf(ComprehendRedactedEndpoint);
    await endpoint.chat({ prompt: text });
    expect(innerChat.mock.calls[0][0].prompt).toBe(
      "My name is [NAME] and my email is john@example.com",
    );
  });
});

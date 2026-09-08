import { describe, expect, test, vi } from "vitest";
import { ComprehendAI } from "../lib/comprehend/comprehend";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-comprehend", () => {
  return {
    LanguageCode: { EN: "en" },
    ComprehendClient: class {
      send = sendMock;
    },
    DetectPiiEntitiesCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

const piiResponse = {
  Entities: [
    { Type: "NAME", Score: 0.99, BeginOffset: 11, EndOffset: 19 },
    { Type: "EMAIL", Score: 0.98, BeginOffset: 32, EndOffset: 51 },
  ],
};

describe("ComprehendAI", () => {
  describe("detectPiiEntities", () => {
    test("returns detected PII entities", async () => {
      sendMock.mockResolvedValueOnce(piiResponse);
      const comprehend = new ComprehendAI({ region: "us-east-1" });
      const entities = await comprehend.detectPiiEntities(
        "Hello from John Doe, mail me at johndoe@example.com.",
      );
      expect(sendMock).toHaveBeenCalled();
      expect(entities).toEqual([
        { type: "NAME", score: 0.99, beginOffset: 11, endOffset: 19 },
        { type: "EMAIL", score: 0.98, beginOffset: 32, endOffset: 51 },
      ]);
    });
  });

  describe("redactPii", () => {
    test("replaces PII spans with entity types by default", async () => {
      sendMock.mockResolvedValueOnce(piiResponse);
      const comprehend = new ComprehendAI({ region: "us-east-1" });
      const redacted = await comprehend.redactPii(
        "Hello from John Doe, mail me at johndoe@example.com.",
      );
      expect(redacted).toEqual("Hello from [NAME], mail me at [EMAIL].");
    });

    test("supports character masking", async () => {
      sendMock.mockResolvedValueOnce({
        Entities: [
          { Type: "NAME", Score: 0.99, BeginOffset: 11, EndOffset: 19 },
        ],
      });
      const comprehend = new ComprehendAI({ region: "us-east-1" });
      const redacted = await comprehend.redactPii("Hello from John Doe", {
        maskMode: "character",
        maskCharacter: "#",
      });
      expect(redacted).toEqual("Hello from ########");
    });

    test("returns the original text when no PII is found", async () => {
      sendMock.mockResolvedValueOnce({ Entities: [] });
      const comprehend = new ComprehendAI({ region: "us-east-1" });
      const redacted = await comprehend.redactPii("Nothing sensitive here.");
      expect(redacted).toEqual("Nothing sensitive here.");
    });
  });

  describe("redact", () => {
    test("redacts the prompt field and keeps other options for chaining", async () => {
      sendMock.mockResolvedValueOnce(piiResponse);
      const comprehend = new ComprehendAI({ region: "us-east-1" });
      const options = await comprehend.redact({
        prompt: "Hello from John Doe, mail me at johndoe@example.com.",
        model: "gpt-3.5-turbo",
        temperature: 0.7,
      });
      expect(options).toEqual({
        prompt: "Hello from [NAME], mail me at [EMAIL].",
        model: "gpt-3.5-turbo",
        temperature: 0.7,
      });
    });

    test("passes options through unchanged when no prompt is present", async () => {
      const comprehend = new ComprehendAI({ region: "us-east-1" });
      const options = await comprehend.redact({ model: "gpt-3.5-turbo" });
      expect(options).toEqual({ model: "gpt-3.5-turbo" });
    });
  });
});

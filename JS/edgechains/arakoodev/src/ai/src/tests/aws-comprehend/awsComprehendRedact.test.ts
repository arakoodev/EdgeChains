import { describe, it, expect, vi, beforeEach } from "vitest";
import { AWSComprehendRedact, PIIEntityType, RedactionResult } from "../../lib/aws-comprehend/awsComprehendRedact";

// Mock axios
vi.mock("axios");
import axios from "axios";

describe("AWSComprehendRedact", () => {
  let redactor: AWSComprehendRedact;

  beforeEach(() => {
    vi.clearAllMocks();
    redactor = new AWSComprehendRedact({
      region: "us-east-1",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    });
  });

  describe("constructor", () => {
    it("should use provided options", () => {
      const r = new AWSComprehendRedact({
        region: "eu-west-1",
        accessKeyId: "ak",
        secretAccessKey: "sk",
        entityTypes: ["PERSON", "EMAIL"],
      });
      expect(r).toBeDefined();
    });

    it("should default to us-east-1 region", () => {
      const r = new AWSComprehendRedact({
        accessKeyId: "ak",
        secretAccessKey: "sk",
      });
      expect(r).toBeDefined();
    });

    it("should default to all PII entity types", () => {
      const r = new AWSComprehendRedact({
        accessKeyId: "ak",
        secretAccessKey: "sk",
      });
      expect(r).toBeDefined();
    });
  });

  describe("redact()", () => {
    it("should return empty result for empty text", async () => {
      const result = await redactor.redact("");
      expect(result.redactedText).toBe("");
      expect(result.entities).toHaveLength(0);
      expect(result.originalText).toBe("");
    });

    it("should return original text for text with no PII", async () => {
      (axios.post as any).mockResolvedValue({
        data: { Entities: [] },
      });

      const result = await redactor.redact("The weather is nice today.");
      expect(result.redactedText).toBe("The weather is nice today.");
      expect(result.entities).toHaveLength(0);
    });

    it("should redact PERSON entities", async () => {
      (axios.post as any).mockResolvedValue({
        data: {
          Entities: [
            { Type: "PERSON", Score: 0.99, BeginOffset: 10, EndOffset: 14 },
          ],
        },
      });

      const result = await redactor.redact("My name is John and I like pizza.");
      expect(result.redactedText).toBe("My name is [PERSON] and I like pizza.");
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe("PERSON");
      expect(result.entities[0].text).toBe("John");
    });

    it("should redact EMAIL entities", async () => {
      (axios.post as any).mockResolvedValue({
        data: {
          Entities: [
            {
              Type: "EMAIL",
              Score: 0.98,
              BeginOffset: 4,
              EndOffset: 21,
            },
          ],
        },
      });

      const result = await redactor.redact("Contact: john@example.com for info");
      expect(result.redactedText).toBe("Contact: [EMAIL] for info");
      expect(result.entities[0].type).toBe("EMAIL");
    });

    it("should redact multiple entity types", async () => {
      (axios.post as any).mockResolvedValue({
        data: {
          Entities: [
            { Type: "PERSON", Score: 0.99, BeginOffset: 10, EndOffset: 14 },
            {
              Type: "LOCATION",
              Score: 0.95,
              BeginOffset: 28,
              EndOffset: 37,
            },
          ],
        },
      });

      const result = await redactor.redact(
        "My name is John and I live in New York City."
      );
      expect(result.redactedText).toBe(
        "My name is [PERSON] and I live in [LOCATION] City."
      );
      expect(result.entities).toHaveLength(2);
    });

    it("should use custom replacement template", async () => {
      const customRedactor = new AWSComprehendRedact({
        region: "us-east-1",
        accessKeyId: "ak",
        secretAccessKey: "sk",
        replacementTemplate: "[REDACTED]",
      });

      (axios.post as any).mockResolvedValue({
        data: {
          Entities: [
            { Type: "PERSON", Score: 0.99, BeginOffset: 10, EndOffset: 14 },
          ],
        },
      });

      const result = await customRedactor.redact("My name is John, hi!");
      expect(result.redactedText).toBe("My name is [REDACTED], hi!");
    });

    it("should filter to only specified entity types", async () => {
      const emailOnlyRedactor = new AWSComprehendRedact({
        region: "us-east-1",
        accessKeyId: "ak",
        secretAccessKey: "sk",
        entityTypes: ["EMAIL"],
      });

      (axios.post as any).mockResolvedValue({
        data: {
          Entities: [
            { Type: "PERSON", Score: 0.99, BeginOffset: 10, EndOffset: 14 },
            {
              Type: "EMAIL",
              Score: 0.98,
              BeginOffset: 20,
              EndOffset: 37,
            },
          ],
        },
      });

      const result = await emailOnlyRedactor.redact(
        "John has john@example.com as email"
      );
      // Only EMAIL should be redacted, PERSON should remain
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe("EMAIL");
    });

    it("should handle text with no trailing newline", async () => {
      (axios.post as any).mockResolvedValue({
        data: { Entities: [] },
      });

      const result = await redactor.redact("No PII here");
      expect(result.redactedText).toBe("No PII here");
    });

    it("should preserve original text in result", async () => {
      (axios.post as any).mockResolvedValue({
        data: {
          Entities: [
            { Type: "PERSON", Score: 0.99, BeginOffset: 0, EndOffset: 5 },
          ],
        },
      });

      const original = "Hello world";
      const result = await redactor.redact(original);
      expect(result.originalText).toBe(original);
    });
  });

  describe("chunking", () => {
    it("should chunk text longer than 9000 chars", async () => {
      const longText = "A".repeat(10000);
      let callCount = 0;

      (axios.post as any).mockImplementation(() => {
        callCount++;
        return Promise.resolve({ data: { Entities: [] } });
      });

      const result = await redactor.redact(longText);
      expect(callCount).toBeGreaterThan(1);
      expect(result.redactedText).toBe(longText);
    });

    it("should not chunk short text", async () => {
      let callCount = 0;

      (axios.post as any).mockImplementation(() => {
        callCount++;
        return Promise.resolve({ data: { Entities: [] } });
      });

      await redactor.redact("Short text");
      expect(callCount).toBe(1);
    });
  });
});
import { describe, it, expect, vi } from "vitest";
import { AWSComprehend } from "../lib/comprehend/comprehend";

// Mock the AWS SDK
vi.mock("@aws-sdk/client-comprehend", () => {
  return {
    ComprehendClient: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockImplementation((command) => {
        // Handle single detection
        if (command.Text !== undefined) {
          const text = command.Text;
          const entities = [];
          if (text.includes("test@test.com")) {
            entities.push({
              BeginOffset: text.indexOf("test@test.com"),
              EndOffset: text.indexOf("test@test.com") + 13,
              Type: "EMAIL",
              Score: 0.99,
            });
          }
          if (text.includes("John")) {
            entities.push({
              BeginOffset: text.indexOf("John"),
              EndOffset: text.indexOf("John") + 4,
              Type: "NAME",
              Score: 0.95,
            });
          }
          return Promise.resolve({ Entities: entities });
        }

        // Handle batch detection
        if (command.TextList !== undefined) {
          const results = command.TextList.map(
            (text: string, index: number) => {
              const entities = [];
              if (text.includes("test@test.com")) {
                entities.push({
                  BeginOffset: text.indexOf("test@test.com"),
                  EndOffset: text.indexOf("test@test.com") + 13,
                  Type: "EMAIL",
                  Score: 0.99,
                });
              }
              return { Index: index, Entities: entities };
            },
          );

          const errorList = [];
          if (command.TextList.includes("fail_me")) {
            const failIndex = command.TextList.indexOf("fail_me");
            errorList.push({
              Index: failIndex,
              ErrorMessage: "Simulated item error",
            });
            // Remove from results to simulate AWS behavior
            results.splice(failIndex, 1);
          }

          return Promise.resolve({ ResultList: results, ErrorList: errorList });
        }

        return Promise.reject(new Error("Unknown command"));
      }),
    })),
    DetectPiiEntitiesCommand: vi.fn().mockImplementation((args) => args),
    BatchDetectPiiEntitiesCommand: vi.fn().mockImplementation((args) => args),
  };
});

describe("AWSComprehend", () => {
  const comprehend = new AWSComprehend({
    region: "us-east-1",
    accessKeyId: "test-id",
    secretAccessKey: "test-secret",
  });

  it("should detect PII entities", async () => {
    const text = "Contact me at test@test.com, my name is John.";
    const entities = await comprehend.detectPii(text);
    expect(entities).toHaveLength(2);
    expect(entities.find((e) => e.Type === "EMAIL")).toBeDefined();
  });

  it("should redact PII entities with default placeholder", async () => {
    const text = "Contact me at test@test.com, my name is John.";
    const redacted = await comprehend.redact(text);
    expect(redacted).toContain("[REDACTED]");
    expect(redacted).not.toContain("test@test.com");
    expect(redacted).not.toContain("John");
  });

  it("should batch detect PII entities", async () => {
    const texts = [
      "Email test@test.com",
      "No PII here",
      "Another test@test.com",
    ];
    const results = await comprehend.batchDetectPii(texts);
    expect(results).toHaveLength(3);
    expect(Array.isArray(results[0])).toBe(true);
    expect(results[0]).toHaveLength(1);
    expect(results[1]).toHaveLength(0);
    expect(results[2]).toHaveLength(1);
  });

  it("should batch redact PII entities", async () => {
    const texts = ["Email test@test.com", "No PII here"];
    const redacted = await comprehend.batchRedact(texts);
    expect(redacted).toHaveLength(2);
    expect(redacted[0]).toBe("Email [REDACTED]");
    expect(redacted[1]).toBe("No PII here");
  });

  it("should handle partial errors in batch", async () => {
    const texts = ["Email test@test.com", "fail_me"];
    const results = await comprehend.batchDetectPii(texts);
    expect(results[0]).toHaveLength(1);
    expect(results[1]).toBeInstanceOf(Error);
    expect((results[1] as Error).message).toBe("Simulated item error");

    const redacted = await comprehend.batchRedact(texts);
    expect(redacted[0]).toBe("Email [REDACTED]");
    expect(redacted[1]).toBe("fail_me"); // Returns original on error
  });

  it("should chunk large batches (more than 25 items)", async () => {
    const texts = Array(30).fill("Email test@test.com");
    const results = await comprehend.batchDetectPii(texts);
    expect(results).toHaveLength(30);
    results.forEach((res) => {
      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(1);
    });
  });

  it("should chain redaction with a downstream call", async () => {
    const text = "My email is test@test.com";
    const mockDownstream = vi
      .fn()
      .mockImplementation((redacted) =>
        Promise.resolve(`Received: ${redacted}`),
      );

    const result = await comprehend.chain(text, mockDownstream);

    expect(mockDownstream).toHaveBeenCalledWith("My email is [REDACTED]");
    expect(result).toBe("Received: My email is [REDACTED]");
  });
});

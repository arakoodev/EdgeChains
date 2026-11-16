import { describe, it, expect, vi } from "vitest";
import { ComprehendRedactor } from "../lib/comprehend-redactor/ComprehendRedactor";

vi.mock("@aws-sdk/client-comprehend", () => {
  const mockSend = vi.fn();
  return {
    ComprehendClient: vi.fn(() => ({
      send: mockSend,
    })),
    DetectPiiEntitiesCommand: vi.fn(),
    __mockSend: mockSend,
  };
});

describe("ComprehendRedactor", () => {
  it("should redact PII from text", async () => {
    const { __mockSend } = await import("@aws-sdk/client-comprehend");

    __mockSend.mockResolvedValueOnce({
      Entities: [
        { Type: "EMAIL", Score: 0.99, BeginOffset: 0, EndOffset: 17 },
        { Type: "PHONE", Score: 0.95, BeginOffset: 18, EndOffset: 30 },
      ],
    });

    const redactor = new ComprehendRedactor({
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
    });

    const result = await redactor.redact("user@example.com 123-456-7890");

    expect(result.redacted).toContain("[EMAIL]");
    expect(result.redacted).toContain("[PHONE]");
    expect(result.piiEntities).toHaveLength(2);
    expect(result.piiEntities[0].type).toBe("EMAIL");
    expect(result.piiEntities[1].type).toBe("PHONE");
  });

  it("should filter by PII types", async () => {
    const { __mockSend } = await import("@aws-sdk/client-comprehend");

    __mockSend.mockResolvedValueOnce({
      Entities: [
        { Type: "EMAIL", Score: 0.99, BeginOffset: 0, EndOffset: 17 },
        { Type: "PHONE", Score: 0.95, BeginOffset: 18, EndOffset: 30 },
      ],
    });

    const redactor = new ComprehendRedactor({});
    const result = await redactor.redact("user@example.com 123-456-7890", ["PHONE"]);

    expect(result.redacted).toBe("user@example.com [PHONE]");
    expect(result.piiEntities).toHaveLength(1);
    expect(result.piiEntities[0].type).toBe("PHONE");
  });

  it("should emit redacted text via observable", async () => {
    const { __mockSend } = await import("@aws-sdk/client-comprehend");

    __mockSend.mockResolvedValueOnce({
      Entities: [
        { Type: "EMAIL", Score: 0.99, BeginOffset: 0, EndOffset: 17 },
      ],
    });

    const redactor = new ComprehendRedactor({});
    const result = await new Promise<any>((resolve, reject) => {
      redactor.redact$("user@example.com").subscribe({
        next: resolve,
        error: reject,
      });
    });

    expect(result.redacted).toContain("[EMAIL]");
  });

  it("should chain with mask$ observable", async () => {
    const { __mockSend } = await import("@aws-sdk/client-comprehend");
    const { of } = await import("rxjs");

    __mockSend.mockResolvedValueOnce({
      Entities: [
        { Type: "EMAIL", Score: 0.99, BeginOffset: 0, EndOffset: 17 },
      ],
    });

    const redactor = new ComprehendRedactor({});
    const source$ = of("contact: user@example.com");

    const result = await new Promise<string>((resolve, reject) => {
      redactor.mask$(source$).subscribe({
        next: resolve,
        error: reject,
      });
    });

    expect(result).toContain("[EMAIL]");
    expect(result).not.toContain("user@example.com");
  });
});

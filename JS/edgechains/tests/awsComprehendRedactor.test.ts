import { describe, it, expect, beforeEach } from "@jest/globals";
import { AWSComprehendRedactor } from "../lib/utils/AWSComprehendRedactor";
import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { of } from "rxjs";

jest.mock("@aws-sdk/client-comprehend");

describe("AWSComprehendRedactor", () => {
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend = jest.fn();
    (ComprehendClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));
  });

  it("should redact email and phone numbers correctly", async () => {
    mockSend.mockResolvedValueOnce({
      Entities: [
        { Type: "EMAIL", BeginOffset: 14, EndOffset: 32, Score: 0.99 },
        { Type: "PHONE", BeginOffset: 36, EndOffset: 48, Score: 0.95 },
      ],
    });

    const redactor = new AWSComprehendRedactor();
    const result = await redactor.redact("Reach out via contact@domain.com or 555-012-3456.");

    expect(result).toBe("Reach out via [REDACTED_EMAIL] or [REDACTED_PHONE].");
    expect(mockSend).toHaveBeenCalledWith(expect.any(DetectPiiEntitiesCommand));
  });

  it("should ignore low confidence scores below threshold", async () => {
    mockSend.mockResolvedValueOnce({
      Entities: [{ Type: "NAME", BeginOffset: 0, EndOffset: 4, Score: 0.5 }],
    });

    const redactor = new AWSComprehendRedactor({ threshold: 0.8 });
    const result = await redactor.redact("John stayed home.");

    expect(result).toBe("John stayed home.");
  });

    it("should integrate with RxJS Observables", (done) => {
    mockSend.mockResolvedValueOnce({
      Entities: [{ Type: "SSN", BeginOffset: 11, EndOffset: 22, Score: 0.99 }],
    });

    const redactor = new AWSComprehendRedactor();
    of("Secret SSN 123-45-6789.")
      .pipe(redactor.redactOperator())
      .subscribe({
        next: (redacted: string) => {
          expect(redacted).toBe("Secret SSN [REDACTED_SSN].");
          done();
        },
        error: done,
      });
  });
});
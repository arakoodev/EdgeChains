import { describe, it, expect, vi } from "vitest";
import { AWSComprehendPIIRedactor } from "./aws-comprehend";

// Mocking AWS SDK secara total dengan factory function
vi.mock("@aws-sdk/client-comprehend", () => {
  return {
    DetectPiiEntitiesCommand: vi.fn(),
    ComprehendClient: class {
      send = vi.fn().mockResolvedValue({
        Entities: [
          { Type: "NAME", BeginOffset: 10, EndOffset: 13 },
          { Type: "PHONE", BeginOffset: 27, EndOffset: 38 }
        ]
      });
    }
  };
});

describe("AWSComprehendPIIRedactor", () => {
  it("harus menyunting teks dengan placeholder yang benar", async () => {
    const redactor = new AWSComprehendPIIRedactor("us-east-1", "fake-key", "fake-secret");
    const input = "Nama saya Sky dan nomor hp 08123456789";
    const result = await redactor.redact(input);

    expect(result).toContain("[REDACTED_NAME]");
    expect(result).toContain("[REDACTED_PHONE]");
    console.log("SUCCESS! HASIL REDACT:", result);
  });
});


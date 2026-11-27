import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComprehendPIIRedactor, PiiEntity } from "../lib/comprehend/comprehend";

describe("ComprehendPIIRedactor", () => {
  let redactor: ComprehendPIIRedactor;
  let detectSpy: any;

  beforeEach(() => {
    redactor = new ComprehendPIIRedactor({
      region: "us-east-1",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
    });
    detectSpy = vi.spyOn(redactor, "detectPiiEntities");
  });

  it("redacts NAME entities above threshold", async () => {
    detectSpy.mockResolvedValue([
      { type: "NAME", beginOffset: 11, endOffset: 17, score: 0.95 },
      { type: "EMAIL", beginOffset: 28, endOffset: 42, score: 0.9 },
    ]);
    const result = await redactor.redact("Hello John Doe, email me at john@example.com");
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("John");
  });

  it("filters entities below threshold", async () => {
    detectSpy.mockResolvedValue([
      { type: "NAME", beginOffset: 0, endOffset: 5, score: 0.3 },
      { type: "PHONE", beginOffset: 10, endOffset: 20, score: 0.9 },
    ]);
    const result = await redactor.redact("Alice 555-1234", { threshold: 0.5 });
    expect(result).not.toContain("Alice");
    expect(result).toContain("[REDACTED]");
  });

  it("uses custom mask", async () => {
    detectSpy.mockResolvedValue([
      { type: "EMAIL", beginOffset: 0, endOffset: 10, score: 0.9 },
    ]);
    const result = await redactor.redact("user@test.com", { mask: "***HIDDEN***" });
    expect(result).toContain("***HIDDEN***");
  });

  it("emits redacted value via Observable", async () => {
    detectSpy.mockResolvedValue([
      { type: "SSN", beginOffset: 0, endOffset: 11, score: 0.9 },
    ]);
    let emitted: string | null = null;
    const unsub = redactor.subscribe((v) => { emitted = v; });
    await redactor.redact("123-45-6789");
    expect(emitted).toContain("[REDACTED]");
    unsub();
  });

  it("pipe chains transformation after redact", async () => {
    detectSpy.mockResolvedValue([
      { type: "NAME", beginOffset: 0, endOffset: 5, score: 0.9 },
    ]);
    let piped: string | null = null;
    const obs = redactor.pipe((t) => t.toUpperCase());
    obs.subscribe((v) => { piped = v; });
    await redactor.redact("Alice says hi");
    expect(piped).toContain("[REDACTED]");
    expect(piped).toBe(piped!.toUpperCase());
  });
});

import { ComprehendPiiRedactor, createPiiRedactor } from "../lib/comprehend/piiRedactor";

describe("ComprehendPiiRedactor", () => {
  it("redacts phone spans from detector output", async () => {
    const redactor = new ComprehendPiiRedactor({
      detectPii: async () => [
        { Type: "PHONE", BeginOffset: 12, EndOffset: 20, Score: 0.99 },
      ],
    });
    const out = await redactor.redact("Call me at 555-0100 please");
    expect(out).toBe("Call me at [REDACTED_PHONE] please");
  });

  it("respects minScore", async () => {
    const redactor = createPiiRedactor({
      minScore: 0.9,
      detectPii: async () => [
        { Type: "EMAIL", BeginOffset: 0, EndOffset: 11, Score: 0.4 },
      ],
    });
    const out = await redactor.redact("a@b.com is fine");
    expect(out).toBe("a@b.com is fine");
  });

  it("redacts multiple entities right-to-left", async () => {
    const text = "Ada 555-0100 a@b.com";
    const redactor = new ComprehendPiiRedactor({
      detectPii: async () => [
        { Type: "NAME", BeginOffset: 0, EndOffset: 3, Score: 0.95 },
        { Type: "PHONE", BeginOffset: 4, EndOffset: 12, Score: 0.99 },
        { Type: "EMAIL", BeginOffset: 13, EndOffset: 20, Score: 0.98 },
      ],
    });
    const out = await redactor.redact(text);
    expect(out).toContain("[REDACTED_NAME]");
    expect(out).toContain("[REDACTED_PHONE]");
    expect(out).toContain("[REDACTED_EMAIL]");
  });

  it("redactMessages maps over chat turns", async () => {
    const redactor = new ComprehendPiiRedactor({
      detectPii: async (t) =>
        t.includes("secret")
          ? [{ Type: "PASSWORD", BeginOffset: t.indexOf("secret"), EndOffset: t.indexOf("secret") + 6, Score: 1 }]
          : [],
    });
    const out = await redactor.redactMessages([
      { role: "user", content: "my secret is here" },
      { role: "assistant", content: "ok" },
    ]);
    expect(out[0].content).toContain("[REDACTED_PASSWORD]");
    expect(out[1].content).toBe("ok");
  });
});

import { describe, it, expect, vi } from "vitest";
import { ComprehendRedactor } from "../lib/comprehend/comprehendRedactor.js";

const mockClient = (Entities: any[]) => {
    const send = vi.fn().mockResolvedValue({ Entities });
    return { client: { send } as any, send };
};

describe("ComprehendRedactor", () => {
    it("redacts detected entities with [TYPE] by default", async () => {
        const text = "Hi Bob, mail bob@x.com now";
        const { client, send } = mockClient([
            { Type: "NAME", BeginOffset: 3, EndOffset: 6, Score: 0.99 },
            { Type: "EMAIL", BeginOffset: 13, EndOffset: 22, Score: 0.99 },
        ]);
        const res = await new ComprehendRedactor({ client }).redact(text);
        expect(res.redacted).toBe("Hi [NAME], mail [EMAIL] now");
        expect(res.entities.map((e) => e.text)).toEqual(["Bob", "bob@x.com"]);
        expect(send.mock.calls[0][0].input).toEqual({ Text: text, LanguageCode: "en" });
    });

    it("handles adjacent and overlapping spans", async () => {
        const { client } = mockClient([
            { Type: "B", BeginOffset: 3, EndOffset: 6 },
            { Type: "A", BeginOffset: 0, EndOffset: 3 },
            { Type: "C", BeginOffset: 4, EndOffset: 8 },
        ]);
        const res = await new ComprehendRedactor({ client }).redact("abcdefghij", { mask: "#" });
        expect(res.redacted).toBe("##ij");
    });

    it("filters by entity type and supports custom mask function", async () => {
        const { client } = mockClient([
            { Type: "NAME", BeginOffset: 0, EndOffset: 3 },
            { Type: "SSN", BeginOffset: 4, EndOffset: 7 },
        ]);
        const res = await new ComprehendRedactor({ client }).redact("Bob 123", {
            entityTypes: ["SSN"],
            mask: (_t, o) => "*".repeat(o.length),
        });
        expect(res.redacted).toBe("Bob ***");
        expect(res.entities).toHaveLength(1);
    });

    it("returns empty text without calling the API", async () => {
        const { client, send } = mockClient([]);
        const res = await new ComprehendRedactor({ client }).redact("");
        expect(res).toEqual({ redacted: "", entities: [] });
        expect(send).not.toHaveBeenCalled();
    });

    it("uses character offsets for multi-byte text", async () => {
        const { client } = mockClient([{ Type: "NAME", BeginOffset: 3, EndOffset: 6 }]);
        const res = await new ComprehendRedactor({ client }).redact("😀é Zoë x");
        expect(res.redacted).toBe("😀é [NAME] x");
    });

    it("propagates API errors", async () => {
        const client = { send: vi.fn().mockRejectedValue(new Error("boom")) } as any;
        await expect(new ComprehendRedactor({ client }).redact("hi")).rejects.toThrow("boom");
    });
});

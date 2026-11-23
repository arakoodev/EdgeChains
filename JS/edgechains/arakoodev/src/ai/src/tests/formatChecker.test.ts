import {
    checkFormat,
    repairToFormat,
    stripCodeFence,
    extractJsonCandidate,
    repairJsonCommonMistakes,
} from "../lib/format-checker/formatChecker";

describe("stripCodeFence", () => {
    it("strips a ```json fenced block", () => {
        expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    });
    it("strips a bare ``` fenced block", () => {
        expect(stripCodeFence('```\nhello\n```')).toBe("hello");
    });
    it("leaves an unfenced string unchanged (after trim)", () => {
        expect(stripCodeFence("  plain text  ")).toBe("plain text");
    });
});

describe("extractJsonCandidate", () => {
    it("returns the whole string when it is already valid JSON", () => {
        const r = extractJsonCandidate('{"a":1}');
        expect(r.candidate).toBe('{"a":1}');
        expect(r.changed).toBe(false);
    });
    it("extracts the first balanced object from noisy prose", () => {
        const r = extractJsonCandidate('Sure! Here is the JSON: {"a":1} Hope that helps.');
        expect(r.candidate).toBe('{"a":1}');
        expect(r.changed).toBe(true);
    });
    it("handles nested braces and strings containing braces", () => {
        const r = extractJsonCandidate('prefix {"a":"}{","b":{"c":2}} suffix');
        expect(r.candidate).toBe('{"a":"}{","b":{"c":2}}');
        expect(() => JSON.parse(r.candidate)).not.toThrow();
    });
});

describe("repairJsonCommonMistakes", () => {
    it("removes trailing commas", () => {
        expect(repairJsonCommonMistakes('{"a":1,}')).toBe('{"a":1}');
        expect(repairJsonCommonMistakes("[1,2,3,]")).toBe("[1,2,3]");
    });
    it("converts single-quoted strings to double-quoted", () => {
        expect(repairJsonCommonMistakes("{'a':1}")).toBe('{"a":1}');
    });
});

describe("checkFormat - json", () => {
    it("accepts valid JSON", () => {
        const r = checkFormat('{"a":1,"b":2}', { format: "json" });
        expect(r.valid).toBe(true);
        expect(r.errors).toEqual([]);
        expect(r.parsed).toEqual({ a: 1, b: 2 });
    });
    it("repairs a fenced JSON block and reports repaired=true", () => {
        const r = checkFormat('```json\n{"a":1}\n```', { format: "json" });
        expect(r.valid).toBe(true);
        expect(r.repaired).toBe(true);
        expect(r.checked).toBe('{"a":1}');
    });
    it("repairs trailing-comma JSON", () => {
        const r = checkFormat('{"a":1,"b":2,}', { format: "json" });
        expect(r.valid).toBe(true);
        expect(r.repaired).toBe(true);
        expect(r.parsed).toEqual({ a: 1, b: 2 });
    });
    it("enforces requiredKeys", () => {
        const r = checkFormat('{"a":1}', { format: "json", requiredKeys: ["a", "b"] });
        expect(r.valid).toBe(false);
        expect(r.errors.join(" ")).toContain('Missing required key: "b"');
    });
    it("fails on non-JSON garbage", () => {
        const r = checkFormat("this is not json at all", { format: "json" });
        expect(r.valid).toBe(false);
        expect(r.errors.length).toBeGreaterThan(0);
    });
    it("rejects a top-level array when requiredKeys are given", () => {
        const r = checkFormat("[1,2,3]", { format: "json", requiredKeys: ["a"] });
        expect(r.valid).toBe(false);
    });
});

describe("checkFormat - lines", () => {
    it("accepts non-empty newline-delimited output", () => {
        const r = checkFormat("one\ntwo\nthree", { format: "lines" });
        expect(r.valid).toBe(true);
    });
    it("rejects empty / whitespace-only output", () => {
        const r = checkFormat("   \n  \n", { format: "lines" });
        expect(r.valid).toBe(false);
    });
});

describe("checkFormat - csv", () => {
    it("accepts a well-formed CSV with expected column count", () => {
        const r = checkFormat("a,b,c\n1,2,3", { format: "csv", expectedColumns: 3 });
        expect(r.valid).toBe(true);
    });
    it("flags rows with the wrong column count", () => {
        const r = checkFormat("a,b,c\n1,2", { format: "csv", expectedColumns: 3 });
        expect(r.valid).toBe(false);
        expect(r.errors.join(" ")).toContain("Row 2 has 2 columns");
    });
    it("respects quoted fields containing commas", () => {
        const r = checkFormat('name,note\n"Doe, John",hi', {
            format: "csv",
            expectedColumns: 2,
        });
        expect(r.valid).toBe(true);
    });
});

describe("checkFormat - regex", () => {
    it("accepts a full match", () => {
        const r = checkFormat("HELLO", { format: "regex", pattern: /^[A-Z]+$/ });
        expect(r.valid).toBe(true);
    });
    it("rejects a partial match (anchored full match required)", () => {
        const r = checkFormat("HELLO123", { format: "regex", pattern: /^[A-Z]+$/ });
        expect(r.valid).toBe(false);
    });
    it("errors when no pattern is supplied", () => {
        const r = checkFormat("anything", { format: "regex" });
        expect(r.valid).toBe(false);
        expect(r.errors.join(" ")).toContain("requires a `pattern`");
    });
});

describe("repairToFormat", () => {
    it("returns the cleaned JSON string", () => {
        expect(repairToFormat('```json\n{"a":1}\n```', { format: "json" })).toBe('{"a":1}');
    });
});
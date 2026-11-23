import { describe, it, expect } from "vitest";
import { z } from "zod";
import { JsonUtils, JsonValidationError } from "../lib/json-utils/jsonUtils";

describe("JsonUtils.extractJson", () => {
    it("extracts a plain JSON object", () => {
        const text = '{"name":"Ada","age":36}';
        expect(JsonUtils.extractJson(text)).toBe('{"name":"Ada","age":36}');
    });

    it("extracts JSON wrapped in a markdown code fence", () => {
        const text = '```json\n{"ok":true}\n```';
        expect(JsonUtils.extractJson(text)).toBe('{"ok":true}');
    });

    it("extracts JSON surrounded by explanatory prose", () => {
        const text =
            'Sure! Here is the result you asked for:\n{"a":1,"b":[2,3]}\nHope that helps.';
        expect(JsonUtils.extractJson(text)).toBe('{"a":1,"b":[2,3]}');
    });

    it("respects braces inside string literals", () => {
        const text = '{"note":"a } and { b","value":42}';
        expect(JsonUtils.extractJson(text)).toBe('{"note":"a } and { b","value":42}');
    });

    it("extracts a top-level JSON array", () => {
        const text = "prefix [1, 2, {\"three\":3}] suffix";
        expect(JsonUtils.extractJson(text)).toBe('[1, 2, {"three":3}]');
    });

    it("returns null when no JSON is present", () => {
        expect(JsonUtils.extractJson("no json here at all")).toBeNull();
    });
});

describe("JsonUtils.parse", () => {
    it("parses a clean object", () => {
        expect(JsonUtils.parse('{"x":10}')).toEqual({ x: 10 });
    });

    it("parses JSON embedded in prose", () => {
        const text = 'The answer is {"answer":42} done.';
        expect(JsonUtils.parse(text)).toEqual({ answer: 42 });
    });

    it("parses JSON inside a code fence", () => {
        const text = '```\n{"hello":"world"}\n```';
        expect(JsonUtils.parse(text)).toEqual({ hello: "world" });
    });

    it("throws JsonValidationError when no JSON exists", () => {
        expect(() => JsonUtils.parse("totally not json")).toThrow(JsonValidationError);
    });

    it("validates against a Zod schema and returns typed data", () => {
        const schema = z.object({ name: z.string(), age: z.number() });
        const text = 'Here you go: {"name":"Grace","age":40} — enjoy!';
        const result = JsonUtils.parseWithSchema(text, schema);
        expect(result).toEqual({ name: "Grace", age: 40 });
    });

    it("throws when parsed JSON fails schema validation", () => {
        const schema = z.object({ name: z.string() });
        const text = '{"name":123}';
        expect(() => JsonUtils.parseWithSchema(text, schema)).toThrow(JsonValidationError);
    });

    it("exposes the raw response on the error for debugging", () => {
        try {
            JsonUtils.parse("not json");
            throw new Error("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(JsonValidationError);
            expect((err as JsonValidationError).raw).toBe("not json");
        }
    });
});

describe("JsonUtils.buildJsonPrompt", () => {
    it("instructs the model to return only JSON", () => {
        const { system, user } = JsonUtils.buildJsonPrompt("List the planets.");
        expect(system).toMatch(/JSON/i);
        expect(user).toContain("List the planets.");
        expect(user).toMatch(/valid JSON/i);
    });

    it("embeds the JSON schema when one is supplied", () => {
        const schema = z.object({ count: z.number() });
        const { user } = JsonUtils.buildJsonPrompt("How many?", schema);
        expect(user).toContain("JSON Schema");
        expect(user).toContain("count");
    });
});
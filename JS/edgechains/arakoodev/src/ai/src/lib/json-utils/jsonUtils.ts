import { z } from "zod";

/**
 * Options controlling how loose LLM text is coerced into JSON.
 */
export interface JsonExtractionOptions {
    /**
     * When true (default) the first balanced JSON object/array found in the
     * text is returned. When false the whole (trimmed) text must be JSON.
     */
    findFirstObject?: boolean;
    /**
     * Optional Zod schema. When provided, {@link JsonUtils.parse} validates the
     * extracted value against it and throws a {@link JsonValidationError} on
     * mismatch.
     */
    schema?: z.ZodTypeAny;
}

/**
 * Error thrown when a model response cannot be coerced into valid JSON or fails
 * schema validation. Carries the raw text so callers can log / retry.
 */
export class JsonValidationError extends Error {
    readonly raw: string;
    readonly cause?: unknown;

    constructor(message: string, raw: string, cause?: unknown) {
        super(message);
        this.name = "JsonValidationError";
        this.raw = raw;
        this.cause = cause;
    }
}

/**
 * JsonUtils centralises the logic required to turn free-form LLM output into
 * structured, validated JSON. Large language models frequently wrap JSON in
 * markdown code fences (```json ... ```), prepend explanatory prose, or emit
 * trailing commentary. These helpers strip that noise, parse the payload and
 * (optionally) validate it against a Zod schema so downstream code can rely on
 * a predictable shape.
 */
export class JsonUtils {
    /**
     * Extract the first balanced JSON value (object or array) from `text`.
     * Returns `null` when no balanced JSON value can be found.
     */
    static extractJson(text: string): string | null {
        if (typeof text !== "string" || text.length === 0) return null;

        // Strip a single leading/trailing markdown code fence if the whole
        // response is wrapped, e.g. ```json\n{...}\n```.
        const unfenced = this.stripCodeFences(text);

        for (let i = 0; i < unfenced.length; i++) {
            const ch = unfenced[i];
            if (ch !== "{" && ch !== "[") continue;
            const candidate = this.readBalanced(unfenced, i);
            if (candidate !== null) return candidate;
        }
        return null;
    }

    /**
     * Parse `text` into a JSON value, tolerating surrounding prose and markdown
     * fences. Optionally validates the result against `options.schema`.
     *
     * @throws {JsonValidationError} when no JSON can be found, the JSON is
     * malformed, or schema validation fails.
     */
    static parse<T = unknown>(text: string, options: JsonExtractionOptions = {}): T {
        const { findFirstObject = true, schema } = options;

        let candidate: string | null;
        if (findFirstObject) {
            candidate = this.extractJson(text);
        } else {
            candidate = this.stripCodeFences(text).trim();
        }

        if (candidate === null) {
            throw new JsonValidationError(
                "No JSON object or array could be found in the model response.",
                text
            );
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(candidate);
        } catch (err) {
            throw new JsonValidationError(
                "Failed to parse the extracted JSON payload.",
                text,
                err
            );
        }

        if (schema) {
            const result = schema.safeParse(parsed);
            if (!result.success) {
                throw new JsonValidationError(
                    `Parsed JSON does not match the expected schema: ${result.error.message}`,
                    text,
                    result.error
                );
            }
            return result.data as T;
        }

        return parsed as T;
    }

    /**
     * Convenience wrapper: parse and validate against a Zod schema in one call.
     */
    static parseWithSchema<S extends z.ZodTypeAny>(text: string, schema: S): z.infer<S> {
        return this.parse<z.infer<S>>(text, { schema });
    }

    /**
     * Build a system/user prompt pair that instructs a model to respond with
     * JSON matching the supplied Zod schema. Useful with providers that lack a
     * native "response_format" / function-calling mode.
     */
    static buildJsonPrompt(
        userPrompt: string,
        schema?: z.ZodTypeAny
    ): { system: string; user: string } {
        const system =
            "You are a strict JSON generator. Respond with a single valid JSON value and " +
            "nothing else. Do not include markdown code fences, explanations, or trailing text.";
        let user = userPrompt;
        if (schema) {
            const jsonSchema = JSON.stringify(this.zodToJsonSchema(schema));
            user +=
                "\n\nYour response MUST be valid JSON conforming to this JSON Schema:\n" +
                jsonSchema;
        } else {
            user += "\n\nYour response MUST be valid JSON.";
        }
        return { system, user };
    }

    /**
     * Strip a single wrapping markdown code fence (``` or ```json ... ```).
     * If the text contains multiple fenced blocks only the outermost wrapping
     * fence is removed; inner content is preserved for the balanced scanner.
     */
    private static stripCodeFences(text: string): string {
        const trimmed = text.trim();
        const fence = /^```[a-zA-Z0-9_-]*\s*\n?([\s\S]*?)\n?```$/;
        const match = trimmed.match(fence);
        if (match) return match[1].trim();
        return trimmed;
    }

    /**
     * Starting at `start` (which must point at `{` or `[`), scan forward and
     * return the balanced substring including the closing bracket. Returns null
     * if the brackets never balance. String literals and escapes are respected.
     */
    private static readBalanced(text: string, start: number): string | null {
        const open = text[start];
        const close = open === "{" ? "}" : "]";
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < text.length; i++) {
            const ch = text[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === '"') {
                    inString = false;
                }
                continue;
            }

            if (ch === '"') {
                inString = true;
            } else if (ch === "{" || ch === "[") {
                depth++;
            } else if (ch === "}" || ch === "]") {
                depth--;
                if (depth === 0) {
                    if (ch === close) return text.slice(start, i + 1);
                    // Mismatched closing bracket -> not a valid candidate.
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * Minimal, dependency-free JSON Schema conversion for the subset of Zod
     * types commonly used to describe LLM responses. Falls back to a permissive
     * object schema for unsupported constructs so prompt generation never throws.
     */
    private static zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
        try {
            // Defer to zod-to-json-schema when available for full fidelity.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require("zod-to-json-schema");
            if (mod && typeof mod.zodToJsonSchema === "function") {
                return mod.zodToJsonSchema(schema, { $refStrategy: "none" });
            }
        } catch {
            // fall through to the permissive fallback below
        }
        return { type: "object", additionalProperties: true };
    }
}
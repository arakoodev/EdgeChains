/**
 * Format Checker Chain (#77)
 *
 * A small, dependency-light utility that validates that an LLM (or any) string
 * response conforms to an expected output format, and can automatically repair
 * common LLM formatting mistakes (stray prose, markdown code fences, trailing
 * commentary, single quotes, trailing commas) before re-validating.
 *
 * The design mirrors the "format checker" idea from
 * https://github.com/hwchase17/langchain/pull/2470 : a checker that returns a
 * structured result describing whether the output matched the expected format
 * and, when it did not, a list of human-readable errors plus an optional
 * repaired candidate.
 *
 * Supported formats:
 *   - "json"   : the response must parse as JSON (optionally against a shape)
 *   - "lines"  : the response must be non-empty newline-delimited records
 *   - "csv"    : the response must be comma-separated rows with a header
 *   - "regex"  : the response must fully match a caller-supplied RegExp
 *
 * The module is intentionally pure (no network, no filesystem) so it can be
 * unit-tested offline and reused by any provider wrapper.
 */

export type FormatCheckerFormat = "json" | "lines" | "csv" | "regex";

export interface FormatCheckerOptions {
    /** The expected output format. */
    format: FormatCheckerFormat;
    /**
     * For format="regex": the pattern the (trimmed) response must fully match.
     * For format="json": an optional list of top-level keys that must be present.
     */
    pattern?: RegExp;
    /** For format="json": required top-level object keys. */
    requiredKeys?: string[];
    /** For format="csv": expected number of columns per row (header included). */
    expectedColumns?: number;
    /**
     * When true (default), the checker will attempt to strip markdown code
     * fences and surrounding prose before validating.
     */
    autoRepair?: boolean;
}

export interface FormatCheckerResult {
    /** Whether the (possibly repaired) output conforms to the expected format. */
    valid: boolean;
    /** The original, unmodified input string. */
    original: string;
    /** The string that was actually validated (after any repair). */
    checked: string;
    /** Whether an automatic repair was applied to produce `checked`. */
    repaired: boolean;
    /** A parsed JSON value when format="json" and parsing succeeded. */
    parsed?: unknown;
    /** Human-readable validation errors (empty when valid). */
    errors: string[];
}

/**
 * Strip a single surrounding markdown code fence (```json ... ``` or ``` ... ```)
 * if present, and trim surrounding whitespace.
 */
export function stripCodeFence(input: string): string {
    let s = input.trim();
    const fence = /^```[a-zA-Z0-9_-]*\s*\n?([\s\S]*?)\n?```$/;
    const m = s.match(fence);
    if (m) {
        s = m[1].trim();
    }
    return s;
}

/**
 * Best-effort extraction of the most likely JSON payload from a noisy LLM
 * response. Tries, in order:
 *   1. the whole (fence-stripped) string
 *   2. the first balanced {...} or [...] block
 * Returns the candidate string and whether a change was made.
 */
export function extractJsonCandidate(input: string): { candidate: string; changed: boolean } {
    const stripped = stripCodeFence(input);
    const tryParse = (s: string): boolean => {
        try {
            JSON.parse(s);
            return true;
        } catch {
            return false;
        }
    };
    if (tryParse(stripped)) {
        return { candidate: stripped, changed: stripped !== input };
    }
    // Find the first balanced object/array block.
    const start = stripped.search(/[{[]/);
    if (start === -1) {
        return { candidate: stripped, changed: stripped !== input };
    }
    const open = stripped[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < stripped.length; i++) {
        const ch = stripped[i];
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
        } else if (ch === open) {
            depth++;
        } else if (ch === close) {
            depth--;
            if (depth === 0) {
                const block = stripped.slice(start, i + 1);
                return { candidate: block, changed: block !== input };
            }
        }
    }
    return { candidate: stripped, changed: stripped !== input };
}

/**
 * Repair common LLM JSON mistakes that occur *inside* an otherwise balanced
 * object: single-quoted strings and trailing commas before a closing brace.
 * Conservative: only applied when the input is not already valid JSON.
 */
export function repairJsonCommonMistakes(input: string): string {
    let s = input;
    // Remove trailing commas before } or ]
    s = s.replace(/,\s*([}\]])/g, "$1");
    // Convert single-quoted strings to double-quoted (best effort, no escapes).
    s = s.replace(/'([^'\\]*)'/g, (_m, inner) => JSON.stringify(inner));
    return s;
}

function validateJson(
    raw: string,
    options: FormatCheckerOptions
): FormatCheckerResult {
    const errors: string[] = [];
    const autoRepair = options.autoRepair !== false;
    let checked = raw;
    let repaired = false;

    const { candidate, changed } = extractJsonCandidate(raw);
    if (changed) {
        checked = candidate;
        repaired = true;
    }

    let parsed: unknown;
    let parseOk = false;
    try {
        parsed = JSON.parse(checked);
        parseOk = true;
    } catch (err) {
        // Attempt a conservative repair pass if enabled.
        if (autoRepair) {
            const repairedCandidate = repairJsonCommonMistakes(checked);
            if (repairedCandidate !== checked) {
                try {
                    parsed = JSON.parse(repairedCandidate);
                    parseOk = true;
                    checked = repairedCandidate;
                    repaired = true;
                } catch {
                    /* fall through to error */
                }
            }
        }
        if (!parseOk) {
            errors.push(
                `Response is not valid JSON: ${(err as Error).message}`
            );
        }
    }

    if (parseOk && options.requiredKeys && options.requiredKeys.length > 0) {
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            errors.push("Expected a JSON object at the top level.");
        } else {
            for (const key of options.requiredKeys) {
                if (!(key in (parsed as Record<string, unknown>))) {
                    errors.push(`Missing required key: "${key}".`);
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        original: raw,
        checked,
        repaired,
        parsed: parseOk ? parsed : undefined,
        errors,
    };
}

function validateLines(raw: string): FormatCheckerResult {
    const checked = stripCodeFence(raw);
    const repaired = checked !== raw;
    const lines = checked
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const errors: string[] = [];
    if (lines.length === 0) {
        errors.push("Response contained no non-empty lines.");
    }
    return {
        valid: errors.length === 0,
        original: raw,
        checked,
        repaired,
        errors,
    };
}

function splitCsvRow(row: string): string[] {
    // Minimal CSV splitter that respects double-quoted fields.
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (inQuotes) {
            if (ch === '"') {
                if (row[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ",") {
            out.push(cur);
            cur = "";
        } else {
            cur += ch;
        }
    }
    out.push(cur);
    return out;
}

function validateCsv(
    raw: string,
    options: FormatCheckerOptions
): FormatCheckerResult {
    const checked = stripCodeFence(raw);
    const repaired = checked !== raw;
    const errors: string[] = [];
    const rows = checked
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => r.length > 0);
    if (rows.length === 0) {
        errors.push("Response contained no CSV rows.");
    } else if (options.expectedColumns !== undefined) {
        rows.forEach((row, idx) => {
            const cols = splitCsvRow(row);
            if (cols.length !== options.expectedColumns) {
                errors.push(
                    `Row ${idx + 1} has ${cols.length} columns, expected ${options.expectedColumns}.`
                );
            }
        });
    }
    return {
        valid: errors.length === 0,
        original: raw,
        checked,
        repaired,
        errors,
    };
}

function validateRegex(
    raw: string,
    options: FormatCheckerOptions
): FormatCheckerResult {
    const checked = stripCodeFence(raw);
    const repaired = checked !== raw;
    const errors: string[] = [];
    if (!options.pattern) {
        errors.push('format="regex" requires a `pattern` option.');
    } else {
        // Anchor a fresh copy so we test a full match regardless of flags.
        const flags = options.pattern.flags.replace(/[gy]/g, "");
        const anchored = new RegExp(
            `^(?:${options.pattern.source})$`,
            flags
        );
        if (!anchored.test(checked)) {
            errors.push(
                `Response does not match required pattern: ${options.pattern.toString()}`
            );
        }
    }
    return {
        valid: errors.length === 0,
        original: raw,
        checked,
        repaired,
        errors,
    };
}

/**
 * Validate (and optionally repair) a response string against an expected format.
 *
 * @example
 *   const r = checkFormat('```json\n{"a":1}\n```', { format: "json", requiredKeys: ["a"] });
 *   // r.valid === true, r.repaired === true
 */
export function checkFormat(
    response: string,
    options: FormatCheckerOptions
): FormatCheckerResult {
    if (typeof response !== "string") {
        return {
            valid: false,
            original: String(response),
            checked: "",
            repaired: false,
            errors: ["Response is not a string."],
        };
    }
    switch (options.format) {
        case "json":
            return validateJson(response, options);
        case "lines":
            return validateLines(response);
        case "csv":
            return validateCsv(response, options);
        case "regex":
            return validateRegex(response, options);
        default: {
            const _exhaustive: never = options.format;
            return {
                valid: false,
                original: response,
                checked: response,
                repaired: false,
                errors: [`Unknown format: ${String(_exhaustive)}`],
            };
        }
    }
}

/**
 * Convenience wrapper that returns only the repaired string when possible, or
 * the original string when no repair could be produced. Useful for "pass the
 * cleaned output to the next step in the chain" flows.
 */
export function repairToFormat(
    response: string,
    options: FormatCheckerOptions
): string {
    const result = checkFormat(response, options);
    return result.checked.length > 0 ? result.checked : response;
}
## Summary

Implements **JSON LLM output formatting** for issue [#119](https://github.com/arakoodev/EdgeChains/issues/119).

Large language models frequently wrap JSON in markdown code fences (```json ... ```), prepend explanatory prose, or emit trailing commentary. This makes naive `JSON.parse(modelOutput)` brittle in production. This PR adds a small, dependency-light utility (`JsonUtils`) to the `@arakoodev/edgechains.js` `ai` module that reliably coerces free-form model output into structured, validated JSON.

Closes #119

## What's added

- **`JsonUtils`** (`JS/edgechains/arakoodev/src/ai/src/lib/json-utils/jsonUtils.ts`):
  - `extractJson(text)` — scans for the first *balanced* JSON object/array, respecting string literals and escapes, and tolerating surrounding prose and markdown code fences.
  - `parse(text, { findFirstObject, schema })` — extracts + `JSON.parse` with optional Zod validation; throws a typed `JsonValidationError` (carrying the raw response) on failure.
  - `parseWithSchema(text, schema)` — one-call parse + Zod validation returning typed data.
  - `buildJsonPrompt(userPrompt, schema?)` — builds a strict system/user prompt pair (embedding the JSON Schema when provided) for providers without native `response_format` / function calling.
- **`JsonValidationError`** — typed error exposing `.raw` so callers can log/retry.
- Exported `JsonUtils`, `JsonValidationError`, and `JsonExtractionOptions` from the `ai` barrel (`src/ai/src/index.ts`), following the existing provider export pattern.

## Branch & fork rationale (targeting)

- **Base branch = `ts` (the repo's default branch).** Although the dispatch template mentions `--base main`, `main` is **not** a viable target for this change: the entire `JS/edgechains/arakoodev/src/ai/` module (where all AI providers live) exists **only on `ts`** — `main` has no `JS/` tree at all (0 `src/ai` files vs 9 on `ts`). `gh repo view arakoodev/EdgeChains` confirms the **default branch is `ts`**, which is the active TypeScript integration branch. Targeting `main` would be an empty/unmergeable change.
- **Head fork = `pethapixels-create/EdgeChains`.** The dispatch-specified `ohffs-edgechains` fork does not exist (GitHub returns 404 for both the `ohffs-edgechains` user and the `ohffs-edgechains/EdgeChains` repo), so the available authenticated fork `pethapixels-create/EdgeChains` is used.

## Design notes

- Follows the repo's existing `lib/<name>/<name>.ts` module layout and the `ai/src/index.ts` barrel-export convention used by `OpenAI`, `GeminiAI`, etc.
- The balanced scanner correctly ignores braces/brackets inside JSON string literals (e.g. `{"note":"a } and { b"}`).
- `zod-to-json-schema` (already a dependency) is used for full-fidelity schema embedding, with a permissive fallback so prompt generation never throws.

## Tests

Added `JS/edgechains/arakoodev/src/ai/src/tests/jsonUtils.test.ts` (Vitest, the repo's test runner) covering:

- plain object, markdown-fenced JSON, JSON embedded in prose
- braces inside string literals
- top-level arrays
- `null` when no JSON present
- parse from clean/fenced/prose inputs
- `JsonValidationError` on missing JSON and on schema mismatch
- `.raw` exposure on error
- `buildJsonPrompt` with and without a schema

### Verification

```
npx vitest run src/ai/src/tests/jsonUtils.test.ts
 ✓ src/ai/src/tests/jsonUtils.test.ts (15 tests) 178ms
 Test Files  1 passed (1)
      Tests  15 passed (15)

npx tsc -b   # exit 0 (clean build)
```
## Summary

Implements [issue #290](https://github.com/arakoodev/EdgeChains/issues/290): integrate **AWS Comprehend** as a utility to redact sensitive data (PII) from text, chainable in front of the existing EdgeChains `Endpoint` classes.

## What was added

### `ComprehendRedactor` utility
`JS/edgechains/arakoodev/src/ai/src/lib/comprehend/comprehend.ts`

- Uses `@aws-sdk/client-comprehend` `DetectPiiEntitiesCommand` to detect PII entities (names, emails, phone numbers, credit cards, SSNs, etc.).
- `detectPiiEntities(text, language)` — returns the raw entities with offsets, scores, and the detected substring.
- `redact(text, options)` — returns `{ redactedText, entities }` with every targeted entity replaced. Entities are replaced back-to-front so Comprehend's character offsets stay valid.
- Options:
  - `replacement` — token used to replace each entity (default `"[REDACTED]"`).
  - `entityTypes` — restrict redaction to a subset of PII types (e.g. `["EMAIL", "PHONE"]`).
  - `language` — language of the input text (default `LanguageCode.EN`).
- Credentials resolve from the standard AWS provider chain (env vars, shared config, IAM role) or can be passed explicitly. A pre-configured `client` can be injected for testing.
- Exported from `JS/edgechains/arakoodev/src/ai/src/index.ts` (value + types).

### Tests
`JS/edgechains/arakoodev/src/ai/src/tests/comprehendRedactor.test.ts` — 6 passing tests covering:
- entity mapping with detected substring
- blank input short-circuit (no AWS call)
- multi-entity redaction with default replacement
- custom replacement token
- `entityTypes` filtering
- adjacent-entity offset integrity

The suite is runner-agnostic (no `jest.fn`/`vi.fn`, bare `describe`/`it`/`expect` globals) so it runs under **both** the repo's `jest` config and its `vitest` script. Added `vitest.config.ts` (`globals: true`) and fixed `jest.config.cjs` (`moduleNameMapper` to resolve NodeNext `.js` import specifiers to `.ts` sources).

### Working example
`JS/edgechains/examples/comprehend-pii-redactor/` — a runnable example (`npm install && npm run start`) that redacts PII from sample strings and prints detected entities, plus a README showing how to chain the redactor in front of `OpenAI`.

## Acceptance criteria mapping

- ✅ New class chainable with existing `Endpoint` classes (as observables) to redact sensitive information in prompts — `ComprehendRedactor` scrubs prompts before they reach `OpenAI`/`GeminiAI`/etc.
- ✅ Testcases for these classes — 6 vitest tests.
- ✅ Full working example in the example folder — `examples/comprehend-pii-redactor/`.

## Verification

- `npx tsc --noEmit` → exit 0 (clean typecheck)
- `npx vitest run src/ai/src/tests/comprehendRedactor.test.ts` → 6/6 passing

Closes #290
# feat: integrate AWS Comprehend as a utility to redact PII data (#290)

Closes #290

## Summary

This PR adds a new, chainable **`ComprehendRedactor`** utility to the EdgeChains
JavaScript SDK (`@arakoodev/edgechains.js`). It uses **Amazon Comprehend**'s
`DetectPiiEntities` API to detect and redact sensitive information (names, emails,
phone numbers, credit cards, SSNs, addresses, etc.) from arbitrary text.

The redactor is designed to be **chained in front of the existing EdgeChains
`Endpoint` classes** (e.g. `OpenAI`, `GeminiAI`, `LlamaAI`) so that prompts are
scrubbed of PII *before* they ever leave the process / reach an LLM.

## What was implemented

### 1. `ComprehendRedactor` class
`JS/edgechains/arakoodev/src/ai/src/lib/comprehend/comprehend.ts`

- Constructor accepts optional credentials (`accessKeyId`, `secretAccessKey`,
  `sessionToken`, `region`) and falls back to the standard AWS default credential
  provider chain (env vars, shared config, IAM role) — mirroring how the other
  EdgeChains AI utilities resolve credentials.
- `detectPiiEntities(text, language?)` — returns the raw PII entities with their
  type, character offsets, confidence score, and the exact matched substring.
- `redact(text, options?)` — returns `{ redactedText, entities }` with every
  targeted entity replaced. Entities are replaced **back-to-front** so the
  character offsets reported by Comprehend stay valid as the string is mutated.
- `RedactOptions` supports:
  - `replacement` — custom replacement token (default `"[REDACTED]"`).
  - `entityTypes` — restrict redaction to a subset of PII types (e.g.
    `["EMAIL", "PHONE"]`).
  - `language` — input language (default `LanguageCode.EN`).
- Blank/whitespace input short-circuits without calling AWS.

### 2. Chainable integration with Endpoint classes
`JS/edgechains/arakoodev/src/ai/src/lib/comprehend/redactorChain.ts`

- **`RedactorChain.wrap(endpoint, redactor, options?)`** — returns a transparent
  `Proxy` around any EdgeChains `Endpoint` (e.g. `OpenAI`, `GeminiAI`,
  `LlamaAI`) whose `chat()` redacts the prompt (and each `messages[].content`)
  **before** the LLM ever sees it. All other members (`streamedChat`,
  `generateEmbeddings`, …) are forwarded unchanged, so the wrapper is a drop-in
  replacement that preserves the endpoint's concrete `chat` signature via
  generics.
- `RedactorChainOptions` supports `redactOptions` (forwarded to
  `ComprehendRedactor.redact`) and `redactResponse` (also scrub the response
  payload's `content`/`text` fields on the way back out).
- `redactPrompt(endpoint, redactor, options?)` — functional one-liner equivalent.

This is what makes the redactor genuinely **chainable with the existing
Endpoint classes as observables / middleware**, satisfying the issue's core
acceptance criterion.

### 3. Public exports
`JS/edgechains/arakoodev/src/ai/src/index.ts`

- Exports `ComprehendRedactor`, `RedactorChain`, `redactPrompt` plus their types
  (`ComprehendRedactorOptions`, `RedactOptions`, `RedactResult`,
  `PiiEntityMatch`, `ChatEndpointLike`, `RedactorChainOptions`).

### 4. Dependency
- Added `@aws-sdk/client-comprehend` to `arakoodev/package.json` dependencies.

### 5. Tests
`JS/edgechains/arakoodev/src/ai/src/tests/comprehendRedactor.test.ts`
`JS/edgechains/arakoodev/src/ai/src/tests/redactorChain.test.ts`
`JS/edgechains/arakoodev/src/ai/src/tests/redactorChainOpenAI.integration.test.ts`

Three deterministic, runner-agnostic Jest suites (also run under the repo's
`vitest` script) that inject a fake Comprehend client and exercise:
- entity mapping (type/offsets/score/matched substring),
- blank-input short-circuit (no AWS call),
- multi-entity redaction with the default replacement,
- custom replacement token,
- `entityTypes` filtering,
- adjacent-entity offset integrity,
- **prompt redaction before the endpoint sees it** (and original options not mutated),
- **per-message redaction** in a `messages` array,
- **response redaction** when `redactResponse` is enabled,
- **transparent proxy forwarding** of non-chat members,
- the `redactPrompt` helper.

The **integration suite** wraps the *real* EdgeChains `OpenAI` endpoint
(`axios` mocked, no network) and asserts on the exact outbound request body that
`OpenAI.chat` would send to the provider — proving the PII is scrubbed before it
ever leaves the process, that `messages`-array prompts are redacted per message,
and that non-chat methods (`streamedChat`) still delegate to the real endpoint.

### 6. Working example
`JS/edgechains/examples/comprehend-pii-redactor/`

A complete, runnable example (`npm install && npm run start`) that redacts PII from
sample strings and prints the detected entities alongside the redacted output. Its
`readme.md` and `src/index.ts` document AWS credential configuration and show how
to **chain** the redactor in front of an `OpenAI` endpoint via `RedactorChain`.

## Test plan

```bash
cd JS/edgechains/arakoodev
npx jest src/ai/src/tests/comprehendRedactor.test.ts
# PASS — 6 tests
npx jest src/ai/src/tests/redactorChain.test.ts
# PASS — 5 tests
npx jest src/ai/src/tests/redactorChainOpenAI.integration.test.ts
# PASS — 3 tests (wraps the real OpenAI endpoint, axios mocked)
npx jest src/ai/src/tests
# PASS — 14 tests total
```

Type-check:

```bash
cd JS/edgechains/arakoodev
npx tsc --noEmit -p tsconfig.json   # exits 0
```

Manual end-to-end (requires AWS credentials with Comprehend access):

```bash
cd JS/edgechains/examples/comprehend-pii-redactor
npm install && npm run start
```

## Notes

- No live AWS calls are made in CI; the unit tests inject a fake client so they
  are fully deterministic and free.
- A loom.com demo video is recommended per the issue's acceptance criteria; the
  runnable example is provided to record it against.
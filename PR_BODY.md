## Add support for Google Palm2 API in JS/TS (#279)

Closes #279. Bounty: arakoodev/EdgeChains#279 ($25, easy).

### Summary
Adds a new `Palm2AI` utility to the EdgeChains JS/TS AI SDK, mirroring the exact
pattern/style of the existing provider integrations (`GeminiAI`, `LlamaAI`,
`OpenAI`). It calls the real Google Palm2 `generateText` endpoint on
`generativelanguage.googleapis.com`.

### What's included
- **`JS/edgechains/arakoodev/src/ai/src/lib/palm2/palm2.ts`** — new `Palm2AI` class:
  - Constructor takes `{ apiKey }` and falls back to `process.env.PALM2_API_KEY`,
    logging a helpful message if the key is missing (same convention as `GeminiAI`).
  - `chat(chatOptions)` POSTs to
    `https://generativelanguage.googleapis.com/v1/models/{model}:generateText`
    (default model `text-bison-001`) with the `x-goog-api-key` header.
  - Supports `temperature`, `candidateCount`, `topK`, `topP`, `maxTokenCount`,
    `model`, plus `max_retry`/`delay` retry options.
  - Uses `axios` + `@lifeomic/attempt` `retry` — identical to `gemini.ts`/`llama.ts`.
  - Exposes typed `Palm2Response` / `Palm2Candidate` / `SafetyRating` / `ContentFilter`
    types matching the Palm2 API response shape.
- **`JS/edgechains/arakoodev/src/ai/src/index.ts`** — exports `Palm2AI`.
- **`JS/edgechains/arakoodev/src/ai/src/testcases/palm2/palm2Endpoints.test.ts`** — Jest suite
  (4 tests, matching the repo's `jest.config.cjs` / `openAiEndpoints.test.ts` convention) that
  mocks `axios` and exercises `Palm2AI.chat()` end-to-end:
  - asserts the request hits the real Palm2 `generateText` URL with `POST`, the
    `Content-Type: application/json` and `x-goog-api-key` headers, and the correct
    `{ prompt: { text }, temperature, candidateCount }` body;
  - verifies the response is parsed from `candidates[0].output`;
  - verifies model / `temperature` / `candidateCount` / `maxTokenCount` overrides;
  - verifies the API key is read from `process.env.PALM2_API_KEY` when not passed;
  - verifies a non-200 (rejected) response propagates as an error.
- **`JS/edgechains/examples/chat-with-palm2/`** — usage example following the
  `chat-with-llm` convention (ArakooServer + jsonnet `main.jsonnet`/`secrets.jsonnet`
  + `generateResponse.cts` RPC calling `Palm2AI`).

### Usage
```ts
import { Palm2AI } from "@arakoodev/edgechains.js/ai";

const palm2 = new Palm2AI({ apiKey: process.env.PALM2_API_KEY });
const res = await palm2.chat({ prompt: "Explain EdgeChains in one sentence." });
console.log(res.candidates[0].output);
```

### Verification
- `npx tsc --noEmit -p tsconfig.json` → **0 errors**
- `npm run build` (`tsc -b`) → **exit 0**
- `npx jest src/ai/src/testcases/palm2/palm2Endpoints.test.ts` → **4 passed (4)**

### Notes
- No API keys are committed; the example `secrets.jsonnet` uses a placeholder.
- The implementation intentionally follows the `GeminiAI` shape (same Google host,
  same axios+retry plumbing) rather than the zod-schema shape used by `OpenAI`.
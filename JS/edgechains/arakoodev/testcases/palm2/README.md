# Gemini request mapping (#279)

The maintainer clarified in issue comment 1893108014 that this task should use
Gemini, not the retired PaLM API. No deprecated PaLM class or alias is added.

Prompts live in `prompts.jsonnet`. Both tests and the runnable example evaluate
that file using the repository's actual Jsonnet WASM interpreter, not JSON.parse
as a substitute for Jsonnet (JSON.parse is used only on the evaluated output).

From `JS/edgechains/arakoodev`:

```sh
node node_modules/vitest/vitest.mjs run src/ai/src/tests/palm2/gemini.test.ts
node node_modules/typescript/bin/tsc -b
node examples/palm2-chat/fixture-demo.cjs
```

The example binds only 127.0.0.1 and uses a synthetic key; it never calls Google.
Tests additionally reject any outgoing Axios request to a non-loopback hostname.
This validates request/response transport locally, not live model availability,
billing, quotas, model quality or Google-account eligibility. It needs no real
credentials. All servers and Jsonnet instances are cleaned up.

## Client changes

- `model` controls the URL; both `name` and `models/name` are accepted. The default
  is Google's documented `gemini-flash-latest` alias, whose underlying model may
  change; callers can select a specific supported model.
- `temperature`, `max_output_tokens` and `responseType` go in `generationConfig`
  as `temperature`, `maxOutputTokens` and `responseMimeType`. Zero temperature and
  zero delay are preserved.
- Existing option names are retained. `max_retry` means total attempts (1..10),
  as the previous implementation's `maxAttempts` did; it is not extra retries.
- 429/5xx and network failures may retry; other HTTP errors do not. Each attempt
  has a timeout (default 30 seconds); redirects are not followed. Errors omit
  Axios request config, response bodies and credentials.
- Optional `baseUrl` supports HTTPS gateways or HTTP loopback fixtures only.
  It must not include URL credentials, query or fragment. A caller choosing a
  custom HTTPS gateway is responsible for trusting that gateway with its key.
- Constructor/chat/response types are exported from the public AI entrypoint.
  Candidate and usage fields can be absent in blocked/partial responses.

Official API reference: https://ai.google.dev/api/generate-content
Model alias reference: https://ai.google.dev/gemini-api/docs/changelog

The initial baseline test accidentally reached the hardcoded Google endpoint
with a synthetic key because the old client ignored baseUrl; it returned HTTP
400. The test transport guard was added before further runs. Those initial
errors are not claimed as Google-service validation or a clean isolated baseline.
